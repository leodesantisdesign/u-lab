// @ulab/core et @ulab/palette sont des dépendances réelles du moteur
// (architecture §6) : @ulab/palette résout un nom de palette en données de
// pixels, ce n'est pas une simple forme de type. @ulab/modules reste
// `import type` uniquement (ETAPE-2.md §3.5) : aucun import de valeur.
import type { ModuleInstance, ParamValue } from '@ulab/core';
import type { ParamDef } from '@ulab/modules';
import { byName as byPaletteName, toFloat3 } from '@ulab/palette';
import { ProgramCache } from './gl.ts';
import { QUAD_VERTEX_SHADER } from './quad.ts';
import { FullscreenTriangle } from './quad.ts';
import { assembleProgram, blendModeIndex } from './program.ts';
import type { ShaderModuleDef } from './program.ts';
import type { MediaResolver, ModuleResolver, RenderableModule } from './types.ts';
import { WorkerRunner } from './worker-runner.ts';
import type { WorkerJob } from './worker-runner.ts';

/** Un module de type 'worker' — même principe que ShaderModuleDef (program.ts). */
type WorkerModuleDef = RenderableModule & { render: Extract<RenderableModule['render'], { kind: 'worker' }> };

// TS ne rétrécit pas le type d'une variable à partir d'une discriminante
// NICHÉE (`def.render.kind`), y compris par élimination après un premier
// garde : ces prédicats le font explicitement, un par kind, plutôt que de
// recopier `def.render.kind === '...'` partout ou de tenter en vain de
// compter sur la narrowing négative d'un seul garde personnalisé.
function isWorkerModule(def: RenderableModule): def is WorkerModuleDef {
	return def.render.kind === 'worker';
}

function isShaderModule(def: RenderableModule): def is ShaderModuleDef {
	return def.render.kind === 'shader';
}

export type PassContext = {
	/** Secondes depuis l'ouverture du projet — `uTime`. */
	time: number;
	/** Numéro de trame — `uFrame`. */
	frame: number;
	/** `project.format.width` — sert à calculer `uScale` (ETAPE-2.md §3.7). */
	documentWidth: number;
};

type RenderTarget = {
	framebuffer: WebGLFramebuffer;
	texture: WebGLTexture;
};

function createRenderTarget(gl: WebGL2RenderingContext, width: number, height: number): RenderTarget {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Impossible d'allouer la texture d'un FBO du pipeline.");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) throw new Error("Impossible d'allouer le FBO du pipeline.");
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return { framebuffer, texture };
}

/** Texture 1×1 transparente : entrée valide pour `uSource` tant qu'aucun média n'est résolu. */
function createFallbackTexture(gl: WebGL2RenderingContext): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw new Error('Impossible d’allouer la texture de repli.');
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA8,
		1,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		new Uint8Array([0, 0, 0, 0]),
	);
	return texture;
}

/** Hash déterministe d'un id d'instance vers un flottant 0..1 — `uSeed`. */
function seedFor(instanceId: string): number {
	let hash = 2166136261; // FNV-1a
	for (let i = 0; i < instanceId.length; i++) {
		hash ^= instanceId.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 0xffffffff;
}

function hexToRgb(hex: string): [number, number, number] {
	const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
	const raw = match?.[1];
	if (!raw) return [0, 0, 0];
	let value = raw;
	if (value.length === 3) {
		value = value
			.split('')
			.map((c) => c + c)
			.join('');
	}
	const int = Number.parseInt(value, 16);
	return [((int >> 16) & 0xff) / 255, ((int >> 8) & 0xff) / 255, (int & 0xff) / 255];
}

// `instance.params` est un proxy réactif Svelte 5 ($state), pas un objet
// simple : postMessage (structuredClone) refuse de le cloner tel quel
// ("DataCloneError"), constaté en direct en testant le premier worker
// jamais branché. Le round-trip JSON en fait une copie plate, sûre pour
// n'importe quel ParamValue (nombre/chaîne/bool/point/tableau/null — tous
// JSON-safe), avant de le confier au Worker.
function toPlainParams(params: Record<string, ParamValue>): Record<string, ParamValue> {
	return JSON.parse(JSON.stringify(params)) as Record<string, ParamValue>;
}

/** Sentinelle `uMediaSize` : aucun média résolu (module source vide, ou passe non-source). */
const NO_MEDIA_SIZE: readonly [number, number] = [0, 0];

function isPoint(value: ParamValue | undefined): value is { x: number; y: number } {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as { x?: unknown }).x === 'number' &&
		typeof (value as { y?: unknown }).y === 'number'
	);
}

// Programme minimal interne, sans rapport avec un module : recopie une
// texture telle quelle vers une cible. Sert à présenter le résultat d'une
// passe worker (une texture déjà prête, pas un dessin GPU) sur le canevas
// quand cette passe est la dernière de la pile. Clé de cache impossible à
// confondre avec un `ModuleDef.type` réel (toujours `catégorie.nom`).
const PASSTHROUGH_KEY = '__ulab_passthrough__';
const PASSTHROUGH_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = texture(uSource, vUv);
}
`;

type WorkerPassState = {
	runner: WorkerRunner;
	/** Résultat le plus récent uploadé en texture — jamais recréée, juste réécrite. */
	texture: WebGLTexture;
	/** Signature de la dernière demande envoyée à `schedule()` (§3.3 : evite de redemander la même chose à chaque frame). */
	dispatchedSignature: string | null;
	/** Un premier résultat est-il déjà arrivé ? Tant que non, la passe est transparente (entrée = sortie). */
	hasResult: boolean;
};

/**
 * Le ping-pong entre deux FBO et l'exécution d'une passe par module actif
 * (ETAPE-2.md §5 et §3.6). Ne connaît aucun module en particulier : tout ce
 * qu'il sait faire vient de `ModuleDef` et `ModuleInstance`.
 */
export class Pipeline {
	private readonly gl: WebGL2RenderingContext;
	private readonly programCache: ProgramCache;
	private readonly triangle: FullscreenTriangle;
	private readonly fallbackTexture: WebGLTexture;
	private readonly mediaTextures = new Map<string, { texture: WebGLTexture; bitmap: ImageBitmap }>();
	private readonly uniformLocations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
	private readonly workerStates = new Map<string, WorkerPassState>();
	/** FBO jetable, sans texture fixe : ancre pour lire N'IMPORTE QUELLE texture via readPixels. */
	private readonly readbackFramebuffer: WebGLFramebuffer;
	/** Un résultat de worker est arrivé de manière asynchrone : il faut redessiner. */
	private readonly onAsyncUpdate?: () => void;

	private width = 0;
	private height = 0;
	private targets: [RenderTarget, RenderTarget] | null = null;

	constructor(gl: WebGL2RenderingContext, onAsyncUpdate?: () => void) {
		this.gl = gl;
		this.onAsyncUpdate = onAsyncUpdate;
		this.programCache = new ProgramCache(gl);
		this.triangle = new FullscreenTriangle(gl);
		this.fallbackTexture = createFallbackTexture(gl);
		const readbackFramebuffer = gl.createFramebuffer();
		if (!readbackFramebuffer) throw new Error('Impossible d’allouer le FBO de lecture du pipeline.');
		this.readbackFramebuffer = readbackFramebuffer;
	}

	/** Réalloue les deux FBO seulement si la taille de rendu a changé (§3.6). */
	resize(width: number, height: number): void {
		if (this.targets && this.width === width && this.height === height) return;
		this.disposeTargets();
		this.width = width;
		this.height = height;
		this.targets = [createRenderTarget(this.gl, width, height), createRenderTarget(this.gl, width, height)];
	}

	/**
	 * Une passe par module actif, dans l'ordre de la pile. La sortie de la
	 * dernière passe va dans le canevas (framebuffer par défaut, `null`).
	 *
	 * Une passe 'worker' (ETAPE-2.md §3.3) ne dessine rien elle-même : elle
	 * lit la texture d'entrée en ImageData, la confie à un WorkerRunner
	 * debounced (non bloquant), et pour CETTE frame réutilise le dernier
	 * résultat connu — jamais un écran vide, jamais de clignotement pendant
	 * le calcul. Le résultat arrive plus tard, hors de cet appel, et prévient
	 * `onAsyncUpdate` pour qu'on redessine.
	 */
	render(
		stack: ModuleInstance[],
		resolveModule: ModuleResolver,
		resolveMedia: MediaResolver,
		context: PassContext,
	): void {
		const gl = this.gl;
		if (!this.targets) throw new Error('Pipeline.resize doit être appelé avant Pipeline.render.');

		const active = stack.filter((instance) => instance.enabled);
		this.pruneMediaTextures(active, resolveModule);
		this.pruneWorkerStates(active);

		if (active.length === 0) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			return;
		}

		let pingIndex: 0 | 1 = 0;
		let previousTexture: WebGLTexture | null = null;

		active.forEach((instance, passIndex) => {
			const def = resolveModule(instance.type);
			if (!def) {
				throw new Error(
					`Module "${instance.type}" absent du registre — instance "${instance.id}" ne peut pas être rendue.`,
				);
			}

			const isLast = passIndex === active.length - 1;
			let inputTexture: WebGLTexture;
			let mediaSize: readonly [number, number] = NO_MEDIA_SIZE;
			if (def.category === 'source') {
				const media = this.resolveMediaTexture(def, instance, resolveMedia);
				inputTexture = media.texture;
				mediaSize = media.size;
			} else {
				inputTexture = previousTexture ?? this.fallbackTexture;
			}

			if (isWorkerModule(def)) {
				const resultTexture = this.runWorkerPassLive(def, instance, active, passIndex, inputTexture, context);
				if (isLast) {
					this.presentTexture(resultTexture, null);
				} else {
					previousTexture = resultTexture;
					// pingIndex ne bouge pas : aucune passe GPU n'a écrit dans un FBO ping-pong ici.
				}
				return;
			}
			if (!isShaderModule(def)) {
				throw new Error(`Module "${instance.type}" : render.kind ni 'shader' ni 'worker'.`);
			}

			const targets = this.targets!;
			const target = isLast ? null : targets[pingIndex];
			this.runPass(def, instance, inputTexture, mediaSize, target, context);

			if (!isLast) {
				previousTexture = targets[pingIndex].texture;
				pingIndex = pingIndex === 0 ? 1 : 0;
			}
		});
	}

	/**
	 * Même chaîne que `render()`, mais pour l'export (ETAPE-2.md §3.6/§3.7) :
	 * aucun debounce, une passe worker est calculée immédiatement et
	 * réellement attendue avant de poursuivre la pile.
	 */
	async renderBlocking(
		stack: ModuleInstance[],
		resolveModule: ModuleResolver,
		resolveMedia: MediaResolver,
		context: PassContext,
	): Promise<void> {
		const gl = this.gl;
		if (!this.targets) throw new Error('Pipeline.resize doit être appelé avant Pipeline.renderBlocking.');

		const active = stack.filter((instance) => instance.enabled);
		this.pruneMediaTextures(active, resolveModule);
		this.pruneWorkerStates(active);

		if (active.length === 0) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			return;
		}

		let pingIndex: 0 | 1 = 0;
		let previousTexture: WebGLTexture | null = null;

		for (let passIndex = 0; passIndex < active.length; passIndex++) {
			const instance = active[passIndex]!;
			const def = resolveModule(instance.type);
			if (!def) {
				throw new Error(
					`Module "${instance.type}" absent du registre — instance "${instance.id}" ne peut pas être rendue.`,
				);
			}

			const isLast = passIndex === active.length - 1;
			let inputTexture: WebGLTexture;
			let mediaSize: readonly [number, number] = NO_MEDIA_SIZE;
			if (def.category === 'source') {
				const media = this.resolveMediaTexture(def, instance, resolveMedia);
				inputTexture = media.texture;
				mediaSize = media.size;
			} else {
				inputTexture = previousTexture ?? this.fallbackTexture;
			}

			if (isWorkerModule(def)) {
				const resultTexture = await this.runWorkerPassBlocking(def, instance, inputTexture, context);
				if (isLast) {
					this.presentTexture(resultTexture, null);
				} else {
					previousTexture = resultTexture;
				}
				continue;
			}
			if (!isShaderModule(def)) {
				throw new Error(`Module "${instance.type}" : render.kind ni 'shader' ni 'worker'.`);
			}

			const targets = this.targets!;
			const target = isLast ? null : targets[pingIndex];
			this.runPass(def, instance, inputTexture, mediaSize, target, context);

			if (!isLast) {
				previousTexture = targets[pingIndex].texture;
				pingIndex = pingIndex === 0 ? 1 : 0;
			}
		}
	}

	dispose(): void {
		this.disposeTargets();
		this.programCache.dispose();
		this.triangle.dispose();
		this.gl.deleteTexture(this.fallbackTexture);
		this.gl.deleteFramebuffer(this.readbackFramebuffer);
		for (const { texture } of this.mediaTextures.values()) this.gl.deleteTexture(texture);
		this.mediaTextures.clear();
		this.uniformLocations.clear();
		for (const state of this.workerStates.values()) {
			state.runner.dispose();
			this.gl.deleteTexture(state.texture);
		}
		this.workerStates.clear();
	}

	private disposeTargets(): void {
		if (!this.targets) return;
		for (const target of this.targets) {
			this.gl.deleteFramebuffer(target.framebuffer);
			this.gl.deleteTexture(target.texture);
		}
		this.targets = null;
	}

	private runPass(
		def: ShaderModuleDef,
		instance: ModuleInstance,
		inputTexture: WebGLTexture,
		mediaSize: readonly [number, number],
		target: RenderTarget | null,
		context: PassContext,
	): void {
		const gl = this.gl;
		const { vertex, fragment } = assembleProgram(def);
		const program = this.programCache.get(def.type, vertex, fragment);
		gl.useProgram(program);

		gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
		const width = target ? this.width : gl.drawingBufferWidth;
		const height = target ? this.height : gl.drawingBufferHeight;
		gl.viewport(0, 0, width, height);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, inputTexture);
		this.setUniform1i(program, 'uSource', 0);
		this.setUniform2f(program, 'uResolution', width, height);
		this.setUniform2f(program, 'uTexel', width > 0 ? 1 / width : 0, height > 0 ? 1 / height : 0);
		// uScale : exactement le facteur de computeRenderSize() (renderer.ts) —
		// jamais 0 même si documentWidth est absurde (ETAPE-2.md §3.7).
		const scale = context.documentWidth > 0 ? width / context.documentWidth : 1.0;
		this.setUniform1f(program, 'uScale', scale);
		this.setUniform1f(program, 'uTime', context.time);
		this.setUniform1i(program, 'uFrame', context.frame);
		this.setUniform1f(program, 'uSeed', seedFor(instance.id));
		this.setUniform2f(program, 'uMediaSize', mediaSize[0], mediaSize[1]);

		for (const param of def.params) {
			this.setParamUniform(program, param, instance.params[param.key]);
		}

		if (def.category !== 'source') {
			this.setUniform1i(program, 'u_blendMode', blendModeIndex(instance.blend.mode));
			this.setUniform1f(program, 'u_blendOpacity', instance.blend.opacity);
		}

		this.triangle.draw();
	}

	/** Dessine `texture` telle quelle sur `target` (ou le canevas si `null`), sans logique de module. */
	private presentTexture(texture: WebGLTexture, target: RenderTarget | null): void {
		const gl = this.gl;
		const program = this.programCache.get(PASSTHROUGH_KEY, QUAD_VERTEX_SHADER, PASSTHROUGH_FRAGMENT);
		gl.useProgram(program);
		gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
		const width = target ? this.width : gl.drawingBufferWidth;
		const height = target ? this.height : gl.drawingBufferHeight;
		gl.viewport(0, 0, width, height);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		this.setUniform1i(program, 'uSource', 0);
		this.triangle.draw();
	}

	/**
	 * Chemin 'worker' non bloquant (aperçu live). Ne calcule jamais depuis
	 * cet appel : lit l'entrée, la confie au WorkerRunner debounced si la
	 * signature a changé, et renvoie le dernier résultat CONNU — la texture
	 * d'entrée elle-même tant qu'aucun résultat n'est encore arrivé.
	 */
	private runWorkerPassLive(
		def: WorkerModuleDef,
		instance: ModuleInstance,
		active: ModuleInstance[],
		passIndex: number,
		inputTexture: WebGLTexture,
		context: PassContext,
	): WebGLTexture {
		const state = this.getOrCreateWorkerState(def, instance);
		const scale = context.documentWidth > 0 ? this.width / context.documentWidth : 1.0;
		const signature = this.computeWorkerSignature(active, passIndex, scale);

		if (signature !== state.dispatchedSignature) {
			state.dispatchedSignature = signature;
			const input = this.readTextureToImageData(inputTexture, this.width, this.height);
			const job: WorkerJob = {
				input,
				params: toPlainParams(instance.params),
				ctx: { seed: seedFor(instance.id), time: context.time, scale },
			};
			state.runner.schedule(job);
		}

		return state.hasResult ? state.texture : inputTexture;
	}

	/**
	 * Chemin 'worker' bloquant (export, ETAPE-2.md §3.6/§3.7) : aucun
	 * debounce, calcule immédiatement et attend réellement la réponse avant
	 * de continuer la pile.
	 */
	private async runWorkerPassBlocking(
		def: WorkerModuleDef,
		instance: ModuleInstance,
		inputTexture: WebGLTexture,
		context: PassContext,
	): Promise<WebGLTexture> {
		const state = this.getOrCreateWorkerState(def, instance);
		const scale = context.documentWidth > 0 ? this.width / context.documentWidth : 1.0;
		const input = this.readTextureToImageData(inputTexture, this.width, this.height);
		const output = await state.runner.runImmediate({
			input,
			params: toPlainParams(instance.params),
			ctx: { seed: seedFor(instance.id), time: context.time, scale },
		});
		this.uploadWorkerResult(state, output);
		return state.texture;
	}

	private getOrCreateWorkerState(def: WorkerModuleDef, instance: ModuleInstance): WorkerPassState {
		const existing = this.workerStates.get(instance.id);
		if (existing) return existing;

		const gl = this.gl;
		const texture = gl.createTexture();
		if (!texture) throw new Error("Impossible d'allouer la texture de résultat d'un module worker.");
		gl.bindTexture(gl.TEXTURE_2D, texture);
		// NEAREST : ce texel EST le pixel de sortie du worker (déjà quantifié sur
		// la palette le cas échéant) — un filtrage LINEAR le mélangerait avec ses
		// voisins et casserait la garantie de couleurs exactes (TRAMAGE.md §5).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const instanceId = instance.id;
		const state: WorkerPassState = {
			runner: new WorkerRunner(def.render.worker, () => this.applyPendingWorkerResult(instanceId)),
			texture,
			dispatchedSignature: null,
			hasResult: false,
		};
		this.workerStates.set(instanceId, state);
		return state;
	}

	/** Appelé par le WorkerRunner (schedule()) quand un résultat asynchrone arrive. */
	private applyPendingWorkerResult(instanceId: string): void {
		const state = this.workerStates.get(instanceId);
		const output = state?.runner.lastResult;
		if (!state || !output) return;
		this.uploadWorkerResult(state, output);
		this.onAsyncUpdate?.();
	}

	private uploadWorkerResult(state: WorkerPassState, output: ImageData): void {
		const gl = this.gl;
		gl.bindTexture(gl.TEXTURE_2D, state.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, output);
		state.hasResult = true;
	}

	/**
	 * Tout ce qui peut affecter les pixels que la passe worker reçoit :
	 * ses propres paramètres, mais aussi tout module en amont (§3.7 : chaque
	 * pixel dépend du voisin déjà traité, donc de toute la chaîne avant lui),
	 * plus l'échelle et la résolution courantes.
	 */
	private computeWorkerSignature(active: ModuleInstance[], passIndexInclusive: number, scale: number): string {
		const upstream = active.slice(0, passIndexInclusive + 1).map((instance) => ({
			type: instance.type,
			params: instance.params,
			blend: instance.blend,
		}));
		return JSON.stringify({ width: this.width, height: this.height, scale, upstream });
	}

	/** Lit n'importe quelle texture en ImageData via le FBO de lecture jetable. */
	private readTextureToImageData(texture: WebGLTexture, width: number, height: number): ImageData {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.readbackFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		const pixels = new Uint8ClampedArray(Math.max(1, width) * Math.max(1, height) * 4);
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return new ImageData(pixels, width, height);
	}

	/** Dispose les WorkerRunner (et leurs textures) des instances qui ont quitté la pile active. */
	private pruneWorkerStates(active: ModuleInstance[]): void {
		if (this.workerStates.size === 0) return;
		const activeIds = new Set(active.map((instance) => instance.id));
		for (const [instanceId, state] of this.workerStates) {
			if (activeIds.has(instanceId)) continue;
			state.runner.dispose();
			this.gl.deleteTexture(state.texture);
			this.workerStates.delete(instanceId);
		}
	}

	private setParamUniform(program: WebGLProgram, param: ParamDef, rawValue: ParamValue | undefined): void {
		const name = `u_${param.key}`;
		switch (param.type) {
			case 'number': {
				const value = typeof rawValue === 'number' ? rawValue : param.default;
				this.setUniform1f(program, name, value);
				break;
			}
			case 'boolean': {
				const value = typeof rawValue === 'boolean' ? rawValue : param.default;
				this.setUniform1i(program, name, value ? 1 : 0);
				break;
			}
			case 'enum': {
				const value = typeof rawValue === 'string' ? rawValue : param.default;
				const index = param.options.indexOf(value);
				this.setUniform1i(program, name, index === -1 ? 0 : index);
				break;
			}
			case 'color': {
				const value = typeof rawValue === 'string' ? rawValue : param.default;
				const [r, g, b] = hexToRgb(value);
				this.setUniform3f(program, name, r, g, b);
				break;
			}
			case 'point': {
				const value = isPoint(rawValue) ? rawValue : param.default;
				this.setUniform2f(program, name, value.x, value.y);
				break;
			}
			case 'palette': {
				const value = typeof rawValue === 'string' ? rawValue : param.default;
				this.setUniform3fv(program, `${name}[0]`, toFloat3(value));
				// 'aucune' ou un nom introuvable ⇒ count = 0 (ETAPE-2.md §3.4) :
				// byPaletteName renvoie undefined dans les deux cas, pas de branche
				// spéciale à écrire ici.
				this.setUniform1i(program, `${name}_count`, byPaletteName(value)?.colors.length ?? 0);
				break;
			}
			case 'text':
			case 'file':
				break; // jamais transmis à un shader (ETAPE-2.md §3.1)
			default: {
				const exhaustive: never = param;
				throw new Error(`Type de paramètre non géré par le pipeline : ${JSON.stringify(exhaustive)}`);
			}
		}
	}

	private resolveMediaTexture(
		def: RenderableModule,
		instance: ModuleInstance,
		resolveMedia: MediaResolver,
	): { texture: WebGLTexture; size: readonly [number, number] } {
		const fileParam = def.params.find((param) => param.type === 'file');
		const mediaId = fileParam ? instance.params[fileParam.key] : undefined;
		if (typeof mediaId !== 'string') return { texture: this.fallbackTexture, size: NO_MEDIA_SIZE };

		const bitmap = resolveMedia(mediaId);
		if (!bitmap) return { texture: this.fallbackTexture, size: NO_MEDIA_SIZE };

		const cached = this.mediaTextures.get(mediaId);
		if (cached && cached.bitmap === bitmap) {
			return { texture: cached.texture, size: [bitmap.width, bitmap.height] };
		}

		const gl = this.gl;
		const texture = cached?.texture ?? gl.createTexture();
		if (!texture) return { texture: this.fallbackTexture, size: NO_MEDIA_SIZE };

		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		// Seul endroit du moteur où une image "du monde extérieur" entre : un
		// ImageBitmap est rangé première ligne = HAUT, alors que `vUv` (quad.ts) a
		// son origine en BAS à gauche. Sans ce flip, le bas de l'écran échantillonne
		// la première ligne du média : l'image sort à l'envers, dans l'aperçu comme
		// à l'export (même Pipeline).
		//
		// Le drapeau est désarmé juste après, et ce n'est pas de la politesse : il
		// est global au contexte GL, et le chemin worker (readTextureToImageData →
		// readPixels bas-haut → worker → texImage2D) est déjà cohérent de bout en
		// bout parce que ses deux inversions s'annulent. Le laisser armé casserait
		// `traitement.dither`.
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

		this.mediaTextures.set(mediaId, { texture, bitmap });
		return { texture, size: [bitmap.width, bitmap.height] };
	}

	/** Libère les textures de médias qu'aucun module source actif ne référence plus. */
	private pruneMediaTextures(active: ModuleInstance[], resolveModule: ModuleResolver): void {
		if (this.mediaTextures.size === 0) return;
		const referenced = new Set<string>();
		for (const instance of active) {
			const def = resolveModule(instance.type);
			if (!def || def.category !== 'source') continue;
			const fileParam = def.params.find((param) => param.type === 'file');
			const mediaId = fileParam ? instance.params[fileParam.key] : undefined;
			if (typeof mediaId === 'string') referenced.add(mediaId);
		}
		for (const [mediaId, { texture }] of this.mediaTextures) {
			if (referenced.has(mediaId)) continue;
			this.gl.deleteTexture(texture);
			this.mediaTextures.delete(mediaId);
		}
	}

	private locationOf(program: WebGLProgram, name: string): WebGLUniformLocation | null {
		let cache = this.uniformLocations.get(program);
		if (!cache) {
			cache = new Map();
			this.uniformLocations.set(program, cache);
		}
		if (cache.has(name)) return cache.get(name) ?? null;
		const location = this.gl.getUniformLocation(program, name);
		cache.set(name, location);
		return location;
	}

	private setUniform1f(program: WebGLProgram, name: string, value: number): void {
		const location = this.locationOf(program, name);
		if (location) this.gl.uniform1f(location, value);
	}

	private setUniform1i(program: WebGLProgram, name: string, value: number): void {
		const location = this.locationOf(program, name);
		if (location) this.gl.uniform1i(location, value);
	}

	private setUniform2f(program: WebGLProgram, name: string, x: number, y: number): void {
		const location = this.locationOf(program, name);
		if (location) this.gl.uniform2f(location, x, y);
	}

	private setUniform3f(program: WebGLProgram, name: string, r: number, g: number, b: number): void {
		const location = this.locationOf(program, name);
		if (location) this.gl.uniform3f(location, r, g, b);
	}

	private setUniform3fv(program: WebGLProgram, name: string, data: Float32Array): void {
		const location = this.locationOf(program, name);
		if (location) this.gl.uniform3fv(location, data);
	}
}
