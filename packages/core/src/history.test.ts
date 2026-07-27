import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from './history';
import { createProject } from './store.svelte';
import type { Project } from './types';

function withName(project: Project, name: string): Project {
	return { ...project, name };
}

describe('History', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with nothing to undo or redo', () => {
		const history = new History(createProject());
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});

	it('undo restores the previous snapshot', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'));

		const restored = history.undo();
		expect(restored?.name).toBe(project.name);
		expect(history.canRedo).toBe(true);
	});

	it('redo re-applies the undone snapshot', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'));
		history.undo();

		const redone = history.redo();
		expect(redone?.name).toBe('v2');
		expect(history.canRedo).toBe(false);
	});

	it('a new push clears the redo stack', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'));
		history.undo();
		history.push(withName(project, 'v3'));

		expect(history.canRedo).toBe(false);
	});

	it('groups pushes sharing a key inside the 400ms window into a single entry', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'), 'halftone.frequency');
		vi.advanceTimersByTime(100);
		history.push(withName(project, 'v3'), 'halftone.frequency');
		vi.advanceTimersByTime(100);
		history.push(withName(project, 'v4'), 'halftone.frequency');

		const afterOneUndo = history.undo();
		expect(afterOneUndo?.name).toBe(project.name);
		expect(history.canUndo).toBe(false);
	});

	it('stops grouping once the 400ms window has elapsed', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'), 'halftone.frequency');
		vi.advanceTimersByTime(401);
		history.push(withName(project, 'v3'), 'halftone.frequency');

		history.undo();
		const afterSecondUndo = history.undo();
		expect(afterSecondUndo?.name).toBe(project.name);
	});

	it('does not group pushes targeting different keys', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'), 'halftone.frequency');
		history.push(withName(project, 'v3'), 'halftone.angle');

		history.undo();
		const afterSecondUndo = history.undo();
		expect(afterSecondUndo?.name).toBe(project.name);
	});

	it('does not group pushes without a group key', () => {
		const project = createProject();
		const history = new History(project);
		history.push(withName(project, 'v2'));
		history.push(withName(project, 'v3'));

		history.undo();
		const afterSecondUndo = history.undo();
		expect(afterSecondUndo?.name).toBe(project.name);
	});
});
