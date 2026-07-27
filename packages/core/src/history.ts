import type { Project } from './types.ts';

export class History {
	private past: string[];
	private future: string[] = [];
	private lastGroupKey: string | null = null;
	private lastPushAt = 0;
	private readonly groupWindowMs: number;

	constructor(initial: Project, groupWindowMs = 400) {
		this.past = [JSON.stringify(initial)];
		this.groupWindowMs = groupWindowMs;
	}

	get canUndo(): boolean {
		return this.past.length > 1;
	}

	get canRedo(): boolean {
		return this.future.length > 0;
	}

	push(project: Project, groupKey?: string): void {
		const now = Date.now();
		const snapshot = JSON.stringify(project);

		const sameGroup =
			groupKey !== undefined &&
			groupKey === this.lastGroupKey &&
			now - this.lastPushAt <= this.groupWindowMs;

		if (sameGroup) {
			this.past[this.past.length - 1] = snapshot;
		} else {
			this.past.push(snapshot);
		}

		this.lastGroupKey = groupKey ?? null;
		this.lastPushAt = now;
		this.future = [];
	}

	undo(): Project | null {
		if (!this.canUndo) return null;
		const current = this.past.pop();
		if (current === undefined) return null;
		this.future.push(current);
		this.lastGroupKey = null;
		const snapshot = this.past[this.past.length - 1];
		if (snapshot === undefined) return null;
		return JSON.parse(snapshot) as Project;
	}

	redo(): Project | null {
		const next = this.future.pop();
		if (next === undefined) return null;
		this.past.push(next);
		this.lastGroupKey = null;
		return JSON.parse(next) as Project;
	}
}
