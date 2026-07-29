// `import type` uniquement depuis @ulab/core pour la forme du document — le
// moteur ne mute jamais un `Project`, il ne fait que le lire.
import type { Project } from '@ulab/core';
import { createGLContext } from './gl.ts';
import { Pipeline } from './pipeline.ts';
import type { MediaResolver, ModuleResolver } from './types.ts';

export type { MediaResolver, ModuleResolver, RenderableModule } from './types.ts';

export type RendererState = 'idle' | 'error';

/**
 * API publique exacte de ETAPE-2.md §3.5, plus `state`/`error` : la
 * consigne du même prompt exige que « les erreurs WebGL ne remontent jamais
 * en silence » et que le moteur « expose un état d'erreur exploitable par
 * l'UI ». Les cinq méthodes documentées sont inchangées ; ces deux lectures
 * sont l'ajout minimal qui rend cette exigence concrète.
 */
export interface Renderer {
	readonly state: RendererState;
	readonly error: Error | null;
	setProject(project: Project): void;
	setQuality(maxSide: number): void;
	start(): void;
	stop(): void;
	renderToBitmap(project: Project, size: { width: number; height: number }): Promise<ImageBitmap>;
	dispose(): void;
}

export type RendererOptions = {
	resolveModule: ModuleResolver;
	resolveMedia: MediaResolver;
};

function toError(value: unknown): Error {
	return value instanceof Error ? value : new Error(String(value));
}

/** Qualité d'aperçu → taille de rendu, plafonnée à la taille du document (§3.6). */
function computeRenderSize(project: Project, maxSide: number): { width: number; height: number } {
	const { width, height } = project.format;
	if (width <= 0 || height <= 0 || maxSide <= 0) return { width: 1, height: 1 };
	const scale = Math.min(1, maxSide / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

class RendererImpl implements Renderer {
	state: RendererState = 'idle';
	error: Error | null = null;

	private readonly canvas: HTMLCanvasElement;
	private readonly resolveModule: ModuleResolver;
	private readonly resolveMedia: MediaResolver;
	private readonly epoch: number;

	private pipeline: Pipeline | null = null;
	private project: Project | null = null;
	private quality = 1024;

	private dirty = false;
	private running = false;
	private rafHandle: number | null = null;
	private frame = 0;

	private readonly onContextLost = (event: Event): void => {
		event.preventDefault();
		this.cancelScheduledFrame();
		this.pipeline?.dispose();
		this.pipeline = null;
		this.setError(new Error('Le contexte WebGL a été perdu.'));
	};

	private readonly onContextRestored = (): void => {
		try {
			const gl = createGLContext(this.canvas);
			this.pipeline = new Pipeline(gl, () => this.markDirty());
			this.state = 'idle';
			this.error = null;
			this.markDirty();
		} catch (err) {
			this.setError(toError(err));
		}
	};

	private readonly onFrame = (): void => {
		this.rafHandle = null;
		this.frame += 1;

		if (this.dirty) {
			this.dirty = false;
			this.renderCurrentProject();
		}
		// Boucle paresseuse (ETAPE-2.md §3.6) : rien ne reprogramme de rAF ici.
		// Le prochain ne sera posé que par un futur setProject/setQuality.
	};

	constructor(canvas: HTMLCanvasElement, opts: RendererOptions) {
		this.canvas = canvas;
		this.resolveModule = opts.resolveModule;
		this.resolveMedia = opts.resolveMedia;
		this.epoch = performance.now();

		canvas.addEventListener('webglcontextlost', this.onContextLost);
		canvas.addEventListener('webglcontextrestored', this.onContextRestored);

		try {
			const gl = createGLContext(canvas);
			// Un résultat de worker arrive de manière asynchrone, hors de tout
			// $effect Svelte : c'est ce callback qui prévient la boucle
			// paresseuse qu'il y a de nouveau quelque chose à dessiner.
			this.pipeline = new Pipeline(gl, () => this.markDirty());
		} catch (err) {
			this.setError(toError(err));
		}
	}

	setProject(project: Project): void {
		this.project = project;
		this.markDirty();
	}

	setQuality(maxSide: number): void {
		if (maxSide === this.quality) return;
		this.quality = maxSide;
		this.markDirty();
	}

	start(): void {
		this.running = true;
		if (this.dirty) this.scheduleFrame();
	}

	stop(): void {
		this.running = false;
		this.cancelScheduledFrame();
	}

	async renderToBitmap(project: Project, size: { width: number; height: number }): Promise<ImageBitmap> {
		if (this.state === 'error') throw this.error ?? new Error("Le moteur est en état d'erreur.");

		// Hors écran, à pleine résolution, sur un canevas dédié — jamais celui
		// de l'aperçu (ETAPE-2.md §3.6) — et aucune référence au DOM : un
		// OffscreenCanvas n'en est pas un. Pipeline jetable, pas de boucle
		// live derrière : pas besoin d'onAsyncUpdate.
		const offscreen = new OffscreenCanvas(Math.max(1, size.width), Math.max(1, size.height));
		const gl = createGLContext(offscreen);
		const pipeline = new Pipeline(gl);
		try {
			pipeline.resize(offscreen.width, offscreen.height);
			// renderBlocking, pas render : à l'export, une passe worker
			// (ETAPE-2.md §3.6/§3.7) se calcule sans debounce et est réellement
			// attendue avant d'encoder — jamais le résultat précédent (il n'y en
			// a pas, ce pipeline est neuf) ni un résultat partiel.
			await pipeline.renderBlocking(project.stack, this.resolveModule, this.resolveMedia, {
				time: this.elapsedSeconds(),
				frame: this.frame,
				documentWidth: project.format.width,
			});
			gl.flush();
			return await createImageBitmap(offscreen);
		} finally {
			pipeline.dispose();
		}
	}

	dispose(): void {
		this.cancelScheduledFrame();
		this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
		this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
		this.pipeline?.dispose();
		this.pipeline = null;
	}

	// -- boucle paresseuse ---------------------------------------------------

	private markDirty(): void {
		this.dirty = true;
		if (this.running) this.scheduleFrame();
	}

	private scheduleFrame(): void {
		if (this.rafHandle !== null) return; // un seul rAF en vol à la fois
		this.rafHandle = requestAnimationFrame(this.onFrame);
	}

	private cancelScheduledFrame(): void {
		if (this.rafHandle === null) return;
		cancelAnimationFrame(this.rafHandle);
		this.rafHandle = null;
	}

	private renderCurrentProject(): void {
		if (!this.project || !this.pipeline) return;
		try {
			const size = computeRenderSize(this.project, this.quality);
			if (this.canvas.width !== size.width) this.canvas.width = size.width;
			if (this.canvas.height !== size.height) this.canvas.height = size.height;

			this.pipeline.resize(size.width, size.height);
			this.pipeline.render(this.project.stack, this.resolveModule, this.resolveMedia, {
				time: this.elapsedSeconds(),
				frame: this.frame,
				documentWidth: this.project.format.width,
			});
		} catch (err) {
			this.setError(toError(err));
		}
	}

	private elapsedSeconds(): number {
		return (performance.now() - this.epoch) / 1000;
	}

	private setError(error: Error): void {
		this.state = 'error';
		this.error = error;
		this.running = false;
		this.cancelScheduledFrame();
	}
}

export function createRenderer(canvas: HTMLCanvasElement, opts: RendererOptions): Renderer {
	return new RendererImpl(canvas, opts);
}
