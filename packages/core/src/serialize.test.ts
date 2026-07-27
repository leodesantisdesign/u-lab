import { describe, expect, it } from 'vitest';
import { fromUlab, toUlab } from './serialize';
import { createProject } from './store.svelte';

describe('serialize', () => {
	it('round-trips a project through toUlab/fromUlab', () => {
		const project = createProject('Mon projet');

		const restored = fromUlab(toUlab(project));

		expect(restored).toEqual(project);
	});

	it('rejects a file with no version field', () => {
		const json = JSON.stringify({ name: 'sans version' });
		expect(() => fromUlab(json)).toThrow(/version/);
	});

	it('rejects a file from a newer, unsupported version', () => {
		const json = JSON.stringify({ version: 99 });
		expect(() => fromUlab(json)).toThrow(/plus récente/);
	});
});
