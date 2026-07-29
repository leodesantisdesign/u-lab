// Un calcul en vol à la fois ; toute nouvelle demande pendant ce calcul
// remplace la précédente en attente, jamais d'empilement (ETAPE-2.md §3.3).
// `schedule` debounce 120 ms avant le PREMIER départ ; si le worker est déjà
// occupé quand le debounce expire, la demande la plus récente attend
// simplement la fin du calcul en cours, sans nouveau délai.

const DEBOUNCE_MS = 120;

export type WorkerJob = {
	input: ImageData;
	params: Record<string, unknown>;
	ctx: { seed: number; time: number; scale: number };
};

type WorkerRequest = {
	requestId: number;
	input: ImageData;
	params: Record<string, unknown>;
	ctx: { seed: number; time: number; scale: number };
};

type WorkerResponse =
	| { requestId: number; output: ImageData }
	| { requestId: number; error: string };

/**
 * Enveloppe un `Worker` de module (contrat ETAPE-2.md §3.3) avec le
 * ordonnancement que packages/engine doit fournir : le module ne sait rien
 * de tout ceci, il exporte juste `process`.
 */
export class WorkerRunner {
	private readonly worker: Worker;
	private busy = false;
	private nextJob: WorkerJob | null = null;
	private debounceHandle: ReturnType<typeof setTimeout> | null = null;
	private nextRequestId = 0;
	private readonly pendingImmediate = new Map<
		number,
		{ resolve: (value: ImageData) => void; reject: (reason: unknown) => void }
	>();

	/** Dernier résultat reçu d'un `schedule()` — jamais écrasé par un rejet. */
	lastResult: ImageData | null = null;

	constructor(
		WorkerCtor: new () => Worker,
		private readonly onResult: () => void,
	) {
		this.worker = new WorkerCtor();
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleMessage(event.data);
		this.worker.onerror = (event: ErrorEvent) => {
			// Un module worker qui lève ne doit ni planter le thread principal ni
			// rester silencieux (architecture §6) : logué, le calcul en vol libéré,
			// le résultat précédent (lastResult) reste affiché tel quel.
			console.error('[@ulab/engine] erreur dans un Worker de module :', event.message);
			this.busy = false;
			this.runNextIfPending();
		};
	}

	/** Debounced (120 ms), non bloquant — chemin aperçu live. */
	schedule(job: WorkerJob): void {
		this.nextJob = job;
		if (this.debounceHandle !== null) clearTimeout(this.debounceHandle);
		this.debounceHandle = setTimeout(() => {
			this.debounceHandle = null;
			this.runNextIfPending();
		}, DEBOUNCE_MS);
	}

	/**
	 * Immédiat, sans debounce — chemin export (ETAPE-2.md §3.6/§3.7) : appelle
	 * réellement le worker et attend sa réponse avant de résoudre.
	 */
	runImmediate(job: WorkerJob): Promise<ImageData> {
		if (this.debounceHandle !== null) {
			clearTimeout(this.debounceHandle);
			this.debounceHandle = null;
		}
		return new Promise((resolve, reject) => {
			const requestId = this.nextRequestId++;
			this.pendingImmediate.set(requestId, { resolve, reject });
			this.post(requestId, job);
		});
	}

	dispose(): void {
		if (this.debounceHandle !== null) clearTimeout(this.debounceHandle);
		this.debounceHandle = null;
		this.nextJob = null;
		for (const { reject } of this.pendingImmediate.values()) reject(new Error('WorkerRunner disposé.'));
		this.pendingImmediate.clear();
		this.worker.terminate();
	}

	private runNextIfPending(): void {
		if (this.busy || !this.nextJob) return;
		const job = this.nextJob;
		this.nextJob = null;
		this.busy = true;
		this.post(this.nextRequestId++, job);
	}

	private post(requestId: number, job: WorkerJob): void {
		const request: WorkerRequest = { requestId, input: job.input, params: job.params, ctx: job.ctx };
		this.worker.postMessage(request, [job.input.data.buffer]);
	}

	private handleMessage(data: WorkerResponse): void {
		const immediate = this.pendingImmediate.get(data.requestId);
		if (immediate) {
			this.pendingImmediate.delete(data.requestId);
			if ('error' in data) immediate.reject(new Error(data.error));
			else immediate.resolve(data.output);
			return;
		}

		// Réponse à un schedule() debounced : libère le calcul en vol avant de
		// relancer runNextIfPending, sinon une demande arrivée entre-temps
		// resterait bloquée derrière `busy` encore vrai.
		this.busy = false;
		if ('output' in data) {
			this.lastResult = data.output;
			this.onResult();
		} else {
			console.error('[@ulab/engine] erreur dans un Worker de module :', data.error);
		}
		this.runNextIfPending();
	}
}
