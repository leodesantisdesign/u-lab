// `import type` uniquement, depuis @ulab/core (dépendance réelle du moteur,
// architecture §6) et @ulab/modules (types seulement, ETAPE-2.md §3.5).
import type { ModuleInstance, ParamValue } from '@ulab/core';
import type { ParamDef } from '@ulab/modules';
import { ProgramCache } from './gl.ts';
import { FullscreenTriangle } from './quad.ts';
import { assembleProgram, blendModeIndex } from './program.ts';
import type { MediaResolver, ModuleResolver, RenderableModule } from './types.ts';

export type PassContext = {
	/** Secondes depuis l'ouverture du projet — `uTime`. */
	time: number;
	/** Numéro de trame — `uFrame`. */
	frame: number;
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

	private width = 0;
	private height = 0;
	private targets: [RenderTarget, RenderTarget] | null = null;

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		this.programCache = new ProgramCache(gl);
		this.triangle = new FullscreenTriangle(gl);
		this.fallbackTexture = createFallbackTexture(gl);
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

			const targets = this.targets!;
			const target = isLast ? null : targets[pingIndex];
			this.runPass(def, instance, inputTexture, mediaSize, target, context);

			if (!isLast) {
				previousTexture = targets[pingIndex].texture;
				pingIndex = pingIndex === 0 ? 1 : 0;
			}
		});
	}

	dispose(): void {
		this.disposeTargets();
		this.programCache.dispose();
		this.triangle.dispose();
		this.gl.deleteTexture(this.fallbackTexture);
		for (const { texture } of this.mediaTextures.values()) this.gl.deleteTexture(texture);
		this.mediaTextures.clear();
		this.uniformLocations.clear();
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
		def: RenderableModule,
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
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

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
}
