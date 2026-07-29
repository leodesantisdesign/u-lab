import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerRunner } from './worker-runner.ts';

// Un faux Worker minimal : capture les postMessage, et laisse le test
// déclencher onmessage/onerror à la main pour simuler une réponse.
class FakeWorker {
	static instances: FakeWorker[] = [];

	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	posted: unknown[] = [];
	terminated = false;

	constructor() {
		FakeWorker.instances.push(this);
	}

	postMessage(data: unknown): void {
		this.posted.push(data);
	}

	terminate(): void {
		this.terminated = true;
	}

	respond(data: unknown): void {
		this.onmessage?.({ data } as MessageEvent);
	}
}

function fakeImageData(): ImageData {
	return { data: new Uint8ClampedArray(4), width: 1, height: 1 } as unknown as ImageData;
}

function job(overrides: Partial<{ params: Record<string, unknown> }> = {}) {
	return {
		input: fakeImageData(),
		params: overrides.params ?? {},
		ctx: { seed: 0, time: 0, scale: 1 },
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	FakeWorker.instances = [];
});

afterEach(() => {
	vi.useRealTimers();
});

describe('WorkerRunner.schedule — debounce', () => {
	it('does not post anything before 120ms have passed', () => {
		const onResult = vi.fn();
		new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult).schedule(job());

		vi.advanceTimersByTime(119);
		expect(FakeWorker.instances[0]?.posted).toHaveLength(0);
	});

	it('posts exactly once, 120ms after the last schedule() call', () => {
		const onResult = vi.fn();
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult);
		runner.schedule(job());

		vi.advanceTimersByTime(120);
		expect(FakeWorker.instances[0]?.posted).toHaveLength(1);
	});

	it('coalesces rapid successive calls into a single dispatch of the latest job', () => {
		const onResult = vi.fn();
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult);

		runner.schedule(job({ params: { levels: 2 } }));
		vi.advanceTimersByTime(60);
		runner.schedule(job({ params: { levels: 4 } }));
		vi.advanceTimersByTime(60);
		runner.schedule(job({ params: { levels: 8 } }));
		vi.advanceTimersByTime(120);

		const worker = FakeWorker.instances[0];
		expect(worker?.posted).toHaveLength(1);
		expect((worker?.posted[0] as { params: { levels: number } }).params).toEqual({ levels: 8 });
	});

	it('a request arriving while busy replaces the pending one — never queues', () => {
		const onResult = vi.fn();
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult);
		const worker = FakeWorker.instances;

		runner.schedule(job({ params: { levels: 2 } }));
		vi.advanceTimersByTime(120); // départ du premier calcul, worker occupé

		runner.schedule(job({ params: { levels: 4 } })); // arrive pendant le calcul
		runner.schedule(job({ params: { levels: 6 } })); // remplace la précédente, pas d'empilement
		vi.advanceTimersByTime(1000); // même longtemps après, rien ne part tant que busy

		expect(worker[0]?.posted).toHaveLength(1); // toujours un seul calcul en vol

		// Le premier calcul se termine : la dernière demande en attente part
		// immédiatement, sans redébouncer.
		worker[0]?.respond({ requestId: 0, output: fakeImageData() });
		expect(worker[0]?.posted).toHaveLength(2);
		expect((worker[0]?.posted[1] as { params: { levels: number } }).params).toEqual({ levels: 6 });
	});

	it('calls onResult and stores lastResult when a response arrives', () => {
		const onResult = vi.fn();
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult);
		runner.schedule(job());
		vi.advanceTimersByTime(120);

		const output = fakeImageData();
		FakeWorker.instances[0]?.respond({ requestId: 0, output });

		expect(onResult).toHaveBeenCalledTimes(1);
		expect(runner.lastResult).toBe(output);
	});

	it('logs and recovers on a worker-reported error, without touching lastResult', () => {
		const onResult = vi.fn();
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, onResult);
		runner.schedule(job());
		vi.advanceTimersByTime(120);

		FakeWorker.instances[0]?.respond({ requestId: 0, error: 'boom' });

		expect(onResult).not.toHaveBeenCalled();
		expect(runner.lastResult).toBeNull();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe('WorkerRunner.runImmediate — export path', () => {
	it('bypasses the debounce entirely', async () => {
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, vi.fn());
		const promise = runner.runImmediate(job());

		expect(FakeWorker.instances[0]?.posted).toHaveLength(1); // parti tout de suite, pas de setTimeout à avancer

		const output = fakeImageData();
		FakeWorker.instances[0]?.respond({ requestId: 0, output });
		await expect(promise).resolves.toBe(output);
	});

	it('rejects on a worker-reported error', async () => {
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, vi.fn());
		const promise = runner.runImmediate(job());
		FakeWorker.instances[0]?.respond({ requestId: 0, error: 'échec' });
		await expect(promise).rejects.toThrow('échec');
	});
});

describe('WorkerRunner.dispose', () => {
	it('terminates the underlying worker and rejects in-flight immediate calls', async () => {
		const runner = new WorkerRunner(FakeWorker as unknown as new () => Worker, vi.fn());
		const promise = runner.runImmediate(job());

		runner.dispose();

		expect(FakeWorker.instances[0]?.terminated).toBe(true);
		await expect(promise).rejects.toThrow();
	});
});
