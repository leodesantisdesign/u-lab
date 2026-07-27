import { describe, expect, it } from 'vitest';
import { DocumentStore } from './store.svelte';

describe('DocumentStore', () => {
	it('adds a module to the stack and selects it', () => {
		const store = new DocumentStore();
		const id = store.addModule('source.image');

		expect(store.project.stack).toHaveLength(1);
		expect(store.project.stack[0]?.type).toBe('source.image');
		expect(store.selectedModuleId).toBe(id);
		expect(store.selectedModule?.id).toBe(id);
	});

	it('inserts a module at a given index without disturbing the rest of the stack', () => {
		const store = new DocumentStore();
		store.addModule('source.image');
		store.addModule('finition.grain');
		const asciiId = store.addModule('traitement.ascii', {}, 1);

		expect(store.project.stack.map((m) => m.type)).toEqual([
			'source.image',
			'traitement.ascii',
			'finition.grain',
		]);
		expect(store.selectedModuleId).toBe(asciiId);
	});

	it('removes a module and clears the selection if it was selected', () => {
		const store = new DocumentStore();
		const id = store.addModule('source.image');

		store.removeModule(id);

		expect(store.project.stack).toHaveLength(0);
		expect(store.selectedModuleId).toBeNull();
	});

	it('reorders the stack with moveModule', () => {
		const store = new DocumentStore();
		store.addModule('source.image');
		store.addModule('traitement.halftone');
		store.addModule('finition.grain');

		store.moveModule(2, 0);

		expect(store.project.stack.map((m) => m.type)).toEqual([
			'finition.grain',
			'source.image',
			'traitement.halftone',
		]);
	});

	it('toggles a module without removing it', () => {
		const store = new DocumentStore();
		const id = store.addModule('finition.grain');

		store.toggleModule(id);
		expect(store.project.stack[0]?.enabled).toBe(false);

		store.toggleModule(id);
		expect(store.project.stack[0]?.enabled).toBe(true);
	});

	it('replaces a module in place, resetting its params but keeping its position', () => {
		const store = new DocumentStore();
		store.addModule('source.image');
		const id = store.addModule('traitement.halftone');
		store.setParam(id, 'frequency', 40);

		store.replaceModule(id, 'traitement.dither');

		expect(store.project.stack[1]?.id).toBe(id);
		expect(store.project.stack[1]?.type).toBe('traitement.dither');
		expect(store.project.stack[1]?.params).toEqual({});
	});

	it('sets a param value on the targeted module', () => {
		const store = new DocumentStore();
		const id = store.addModule('traitement.halftone');

		store.setParam(id, 'frequency', 40);

		expect(store.project.stack[0]?.params.frequency).toBe(40);
	});

	it('exposes the first stack item as the source', () => {
		const store = new DocumentStore();
		expect(store.source).toBeNull();

		store.addModule('source.image');
		expect(store.source?.type).toBe('source.image');
	});

	it('undoes and redoes a module addition', () => {
		const store = new DocumentStore();
		store.addModule('source.image');
		expect(store.project.stack).toHaveLength(1);

		store.undo();
		expect(store.project.stack).toHaveLength(0);

		store.redo();
		expect(store.project.stack).toHaveLength(1);
		expect(store.project.stack[0]?.type).toBe('source.image');
	});

	it('undoes a removal back to the exact previous state', () => {
		const store = new DocumentStore();
		const id = store.addModule('finition.grain');
		store.removeModule(id);
		expect(store.project.stack).toHaveLength(0);

		store.undo();
		expect(store.project.stack).toHaveLength(1);
		expect(store.project.stack[0]?.id).toBe(id);
	});

	it('adds a modulation targeting a param, with sensible defaults', () => {
		const store = new DocumentStore();
		const moduleId = store.addModule('traitement.halftone');

		const id = store.addModulation({ moduleId, paramKey: 'frequency' }, { kind: 'keyframes', points: [] });

		expect(store.project.modulations).toHaveLength(1);
		const modulation = store.project.modulations[0];
		expect(modulation?.id).toBe(id);
		expect(modulation?.enabled).toBe(true);
		expect(modulation?.target).toEqual({ moduleId, paramKey: 'frequency' });
		expect(modulation?.sensitivity).toBe(0.5);
		expect(modulation?.range).toEqual([0, 1]);
	});

	it('removes a modulation', () => {
		const store = new DocumentStore();
		const moduleId = store.addModule('traitement.halftone');
		const id = store.addModulation({ moduleId, paramKey: 'frequency' }, { kind: 'keyframes', points: [] });

		store.removeModulation(id);

		expect(store.project.modulations).toHaveLength(0);
	});

	it('reorders modulations with moveModulation', () => {
		const store = new DocumentStore();
		const moduleId = store.addModule('traitement.halftone');
		const a = store.addModulation({ moduleId, paramKey: 'frequency' }, { kind: 'keyframes', points: [] });
		const b = store.addModulation({ moduleId, paramKey: 'angle' }, { kind: 'keyframes', points: [] });

		store.moveModulation(1, 0);

		expect(store.project.modulations.map((m) => m.id)).toEqual([b, a]);
	});

	it('toggles a modulation on and off', () => {
		const store = new DocumentStore();
		const moduleId = store.addModule('traitement.halftone');
		const id = store.addModulation({ moduleId, paramKey: 'frequency' }, { kind: 'keyframes', points: [] });

		store.toggleModulation(id);
		expect(store.project.modulations[0]?.enabled).toBe(false);

		store.toggleModulation(id);
		expect(store.project.modulations[0]?.enabled).toBe(true);
	});

	it('updates a modulation source, sensitivity and range', () => {
		const store = new DocumentStore();
		const moduleId = store.addModule('traitement.halftone');
		const id = store.addModulation({ moduleId, paramKey: 'frequency' }, { kind: 'keyframes', points: [] });

		store.setModulationSource(id, { kind: 'video', signal: 'luma' });
		store.setModulationSensitivity(id, 0.8);
		store.setModulationRange(id, [10, 90]);

		const modulation = store.project.modulations[0];
		expect(modulation?.source).toEqual({ kind: 'video', signal: 'luma' });
		expect(modulation?.sensitivity).toBe(0.8);
		expect(modulation?.range).toEqual([10, 90]);
	});

	it('adding a module then undoing once removes it', () => {
		const store = new DocumentStore();

		store.addModule('source.image');
		expect(store.project.stack).toHaveLength(1);

		store.undo();
		expect(store.project.stack).toHaveLength(0);
	});

	it('collapses fifty successive setParam calls on the same key into one history entry', () => {
		const store = new DocumentStore();
		const id = store.addModule('traitement.halftone');

		for (let i = 0; i < 50; i++) {
			store.setParam(id, 'frequency', i);
		}

		expect(store.project.stack[0]?.params.frequency).toBe(49);
		store.undo();
		expect(store.project.stack[0]?.params.frequency).toBeUndefined();
	});

	it('setParam on two different keys produces two history entries', () => {
		const store = new DocumentStore();
		const id = store.addModule('traitement.halftone');

		store.setParam(id, 'frequency', 40);
		store.setParam(id, 'angle', 30);

		store.undo();
		expect(store.project.stack[0]?.params.angle).toBeUndefined();
		expect(store.project.stack[0]?.params.frequency).toBe(40);

		store.undo();
		expect(store.project.stack[0]?.params.frequency).toBeUndefined();
	});

	it('resetParams replaces the whole params block in one history entry', () => {
		const store = new DocumentStore();
		const id = store.addModule('traitement.halftone');
		store.setParam(id, 'frequency', 40);
		store.setParam(id, 'angle', 30);

		store.resetParams(id, { frequency: 10, angle: 0 });

		expect(store.project.stack[0]?.params).toEqual({ frequency: 10, angle: 0 });

		store.undo();
		expect(store.project.stack[0]?.params).toEqual({ frequency: 40, angle: 30 });
	});

	it('setFormat is undoable', () => {
		const store = new DocumentStore();
		const before = store.project.format;

		store.setFormat({ ratio: '16:9', width: 1920, height: 1080 });
		expect(store.project.format).toEqual({ ratio: '16:9', width: 1920, height: 1080 });

		store.undo();
		expect(store.project.format).toEqual(before);
	});

	it('never exceeds 100 history entries', () => {
		const store = new DocumentStore();

		for (let i = 0; i < 150; i++) {
			store.addModule('finition.grain');
		}

		let undoCount = 0;
		while (store.canUndo) {
			store.undo();
			undoCount++;
		}

		expect(undoCount).toBe(99);
	});
});
