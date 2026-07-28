import { History } from './history.ts';
import type { BlendMode, MediaRef, ModSource, Modulation, ModuleInstance, ParamValue, Project } from './types.ts';

export function createProject(name = 'Sans titre'): Project {
	const now = Date.now();
	return {
		id: crypto.randomUUID(),
		name,
		version: 1,
		createdAt: now,
		updatedAt: now,
		format: { ratio: '1:1', width: 1024, height: 1024 },
		duration: 0,
		fps: 30,
		stack: [],
		modulations: [],
		media: [],
	};
}

export class DocumentStore {
	project: Project = $state(createProject());
	selectedModuleId: string | null = $state(null);

	private readonly history: History;

	selectedModule = $derived(
		this.project.stack.find((m) => m.id === this.selectedModuleId) ?? null,
	);

	source = $derived(this.project.stack[0] ?? null);

	constructor(initial?: Project) {
		if (initial) this.project = initial;
		this.history = new History(this.project);
	}

	get canUndo(): boolean {
		return this.history.canUndo;
	}

	get canRedo(): boolean {
		return this.history.canRedo;
	}

	addModule(type: string, initialParams: Record<string, ParamValue> = {}, atIndex?: number): string {
		const instance: ModuleInstance = {
			id: crypto.randomUUID(),
			type,
			enabled: true,
			params: { ...initialParams },
			blend: { mode: 'normal', opacity: 1 },
		};
		const index = atIndex ?? this.project.stack.length;
		this.project.stack.splice(index, 0, instance);
		this.selectedModuleId = instance.id;
		this.commit();
		return instance.id;
	}

	removeModule(id: string): void {
		const index = this.project.stack.findIndex((m) => m.id === id);
		if (index === -1) return;
		this.project.stack.splice(index, 1);
		if (this.selectedModuleId === id) this.selectedModuleId = null;
		this.commit();
	}

	moveModule(from: number, to: number): void {
		const stack = this.project.stack;
		if (from < 0 || from >= stack.length || to < 0 || to >= stack.length) return;
		const [instance] = stack.splice(from, 1);
		if (!instance) return;
		stack.splice(to, 0, instance);
		this.commit();
	}

	toggleModule(id: string): void {
		const instance = this.project.stack.find((m) => m.id === id);
		if (!instance) return;
		instance.enabled = !instance.enabled;
		this.commit();
	}

	replaceModule(id: string, newType: string, initialParams: Record<string, ParamValue> = {}): void {
		const instance = this.project.stack.find((m) => m.id === id);
		if (!instance) return;
		instance.type = newType;
		instance.params = { ...initialParams };
		this.commit();
	}

	setParam(moduleId: string, key: string, value: ParamValue): void {
		const instance = this.project.stack.find((m) => m.id === moduleId);
		if (!instance) return;
		instance.params[key] = value;
		this.commit(`${moduleId}.${key}`);
	}

	resetParams(moduleId: string, params: Record<string, ParamValue>): void {
		const instance = this.project.stack.find((m) => m.id === moduleId);
		if (!instance) return;
		instance.params = { ...params };
		this.commit();
	}

	setBlend(moduleId: string, blend: { mode: BlendMode; opacity: number }): void {
		const instance = this.project.stack.find((m) => m.id === moduleId);
		if (!instance) return;
		const groupKey = instance.blend.mode === blend.mode ? 'blend.opacity' : 'blend.mode';
		instance.blend = { ...blend };
		this.commit(`${moduleId}.${groupKey}`);
	}

	setFormat(format: { ratio: string; width: number; height: number }): void {
		this.project.format = { ...format };
		this.commit();
	}

	/**
	 * `groupKey` permet à l'appelant de fusionner ce commit avec le
	 * `setParam` qui l'accompagne typiquement (poser un `MediaRef` puis le
	 * référencer dans un paramètre 'file') : un seul geste utilisateur, une
	 * seule entrée d'historique — même mécanisme que `setBlend` ou
	 * `setModulationSensitivity`.
	 */
	addMedia(ref: MediaRef, groupKey?: string): void {
		this.project.media.push(ref);
		this.commit(groupKey);
	}

	removeMedia(id: string): void {
		const index = this.project.media.findIndex((m) => m.id === id);
		if (index === -1) return;
		this.project.media.splice(index, 1);
		this.commit();
	}

	addModulation(target: { moduleId: string; paramKey: string }, source: ModSource): string {
		const modulation: Modulation = {
			id: crypto.randomUUID(),
			enabled: true,
			target,
			source,
			sensitivity: 0.5,
			range: [0, 1],
		};
		this.project.modulations.push(modulation);
		this.commit();
		return modulation.id;
	}

	removeModulation(id: string): void {
		const index = this.project.modulations.findIndex((m) => m.id === id);
		if (index === -1) return;
		this.project.modulations.splice(index, 1);
		this.commit();
	}

	moveModulation(from: number, to: number): void {
		const modulations = this.project.modulations;
		if (from < 0 || from >= modulations.length || to < 0 || to >= modulations.length) return;
		const [modulation] = modulations.splice(from, 1);
		if (!modulation) return;
		modulations.splice(to, 0, modulation);
		this.commit();
	}

	toggleModulation(id: string): void {
		const modulation = this.project.modulations.find((m) => m.id === id);
		if (!modulation) return;
		modulation.enabled = !modulation.enabled;
		this.commit();
	}

	setModulationTarget(id: string, target: { moduleId: string; paramKey: string }): void {
		const modulation = this.project.modulations.find((m) => m.id === id);
		if (!modulation) return;
		modulation.target = target;
		this.commit();
	}

	setModulationSource(id: string, source: ModSource): void {
		const modulation = this.project.modulations.find((m) => m.id === id);
		if (!modulation) return;
		modulation.source = source;
		this.commit();
	}

	setModulationSensitivity(id: string, sensitivity: number): void {
		const modulation = this.project.modulations.find((m) => m.id === id);
		if (!modulation) return;
		modulation.sensitivity = sensitivity;
		this.commit(`modulation.${id}.sensitivity`);
	}

	setModulationRange(id: string, range: [number, number]): void {
		const modulation = this.project.modulations.find((m) => m.id === id);
		if (!modulation) return;
		modulation.range = range;
		this.commit(`modulation.${id}.range`);
	}

	undo(): void {
		const snapshot = this.history.undo();
		if (snapshot) this.project = snapshot;
	}

	redo(): void {
		const snapshot = this.history.redo();
		if (snapshot) this.project = snapshot;
	}

	private commit(groupKey?: string): void {
		this.project.updatedAt = Date.now();
		this.history.push(this.project, groupKey);
	}
}
