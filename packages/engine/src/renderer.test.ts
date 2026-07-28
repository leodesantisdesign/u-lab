import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@ulab/core';
import type { ModuleDef } from '@ulab/modules';
import { createRenderer } from './renderer.ts';

/**
 * Preuve instrumentée de la boucle paresseuse (ETAPE-2.md §3.6) : on
 * remplace `requestAnimationFrame`/`cancelAnimationFrame` par une file
 * qu'on contrôle à la main, et on compte combien de frames sont
 * programmées à chaque étape du cycle de vie du renderer — sans jamais
 * en laisser tourner une automatiquement.
 */

let rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = [];
let nextRafId = 1;

beforeEach(() => {
	rafQueue = [];
	nextRafId = 1;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
		const id = nextRafId++;
		rafQueue.push({ id, cb });
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
		rafQueue = rafQueue.filter((entry) => entry.id !== id);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function flushOneFrame(time = 0): void {
	const next = rafQueue.shift();
	if (!next) throw new Error('Aucune frame programmée à vidanger.');
	next.cb(time);
}

// -- Une pile WebGL2 minimale : chaque appel réussit et renvoie un objet
// non-nul, exactement comme un vrai contexte le ferait pour ce manifeste de
// test. Elle ne dessine rien de réel — ce test vérifie l'ordonnancement des
// frames, pas des pixels (le rendu de pixels est couvert visuellement au
// prompt 4 de ETAPE-2.md, une fois un vrai module branché sur l'écran).
function createFakeGL(): WebGL2RenderingContext {
	const gl: Record<string, unknown> = {
		VERTEX_SHADER: 1,
		FRAGMENT_SHADER: 2,
		COMPILE_STATUS: 3,
		LINK_STATUS: 4,
		TRIANGLES: 5,
		TEXTURE_2D: 6,
		TEXTURE_MIN_FILTER: 7,
		TEXTURE_MAG_FILTER: 8,
		LINEAR: 9,
		NEAREST: 10,
		TEXTURE_WRAP_S: 11,
		TEXTURE_WRAP_T: 12,
		CLAMP_TO_EDGE: 13,
		RGBA8: 14,
		RGBA: 15,
		UNSIGNED_BYTE: 16,
		FRAMEBUFFER: 17,
		COLOR_ATTACHMENT0: 18,
		COLOR_BUFFER_BIT: 19,
		TEXTURE0: 20,
		drawingBufferWidth: 8,
		drawingBufferHeight: 8,

		createShader: () => ({}),
		shaderSource: () => {},
		compileShader: () => {},
		getShaderParameter: () => true,
		getShaderInfoLog: () => '',
		deleteShader: () => {},

		createProgram: () => ({}),
		attachShader: () => {},
		linkProgram: () => {},
		getProgramParameter: () => true,
		getProgramInfoLog: () => '',
		deleteProgram: () => {},
		useProgram: () => {},

		createVertexArray: () => ({}),
		bindVertexArray: () => {},
		deleteVertexArray: () => {},
		drawArrays: () => {},

		createTexture: () => ({}),
		bindTexture: () => {},
		texParameteri: () => {},
		texImage2D: () => {},
		deleteTexture: () => {},
		activeTexture: () => {},

		createFramebuffer: () => ({}),
		bindFramebuffer: () => {},
		framebufferTexture2D: () => {},
		deleteFramebuffer: () => {},

		viewport: () => {},
		clearColor: () => {},
		clear: () => {},
		flush: () => {},

		getUniformLocation: () => ({}),
		uniform1f: () => {},
		uniform1i: () => {},
		uniform2f: () => {},
		uniform3f: () => {},
	};
	return gl as unknown as WebGL2RenderingContext;
}

function createFakeCanvas(): HTMLCanvasElement {
	const listeners = new Map<string, Set<EventListener>>();
	const canvas = {
		width: 0,
		height: 0,
		getContext: () => createFakeGL(),
		addEventListener: (type: string, listener: EventListener) => {
			let set = listeners.get(type);
			if (!set) {
				set = new Set();
				listeners.set(type, set);
			}
			set.add(listener);
		},
		removeEventListener: (type: string, listener: EventListener) => {
			listeners.get(type)?.delete(listener);
		},
	};
	return canvas as unknown as HTMLCanvasElement;
}

const SOURCE_DEF: ModuleDef = {
	type: 'source.image',
	category: 'source',
	name: 'Image',
	summary: 'Test',
	thumbnail: './thumbnail.webp',
	params: [{ key: 'file', label: 'Fichier', type: 'file', default: null }],
	render: { kind: 'shader', fragment: 'vec4 ulab_main(vec4 src, vec2 uv) { return src; }' },
};

function resolveModule(type: string): ModuleDef | undefined {
	return type === SOURCE_DEF.type ? SOURCE_DEF : undefined;
}

function resolveMedia(): ImageBitmap | undefined {
	return undefined;
}

function fakeProject(): Project {
	return {
		id: 'p1',
		name: 'Test',
		version: 1,
		createdAt: 0,
		updatedAt: 0,
		format: { ratio: '1:1', width: 64, height: 64 },
		duration: 0,
		fps: 30,
		stack: [
			{
				id: 'm1',
				type: 'source.image',
				enabled: true,
				params: { file: null },
				blend: { mode: 'normal', opacity: 1 },
			},
		],
		modulations: [],
		media: [],
	};
}

describe('createRenderer — boucle paresseuse', () => {
	it("ne programme aucun rAF tant que rien n'est sale", () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.start();
		expect(rafQueue.length).toBe(0);
		renderer.dispose();
	});

	it("setProject() avant start() ne programme rien tant que start() n'a pas été appelé", () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.setProject(fakeProject());
		expect(rafQueue.length).toBe(0);
		renderer.start();
		expect(rafQueue.length).toBe(1);
		renderer.dispose();
	});

	it('setProject() programme exactement un rAF, jamais un deuxième tant que le premier est en vol', () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.start();
		renderer.setProject(fakeProject());
		expect(rafQueue.length).toBe(1);
		renderer.setProject(fakeProject());
		renderer.setProject(fakeProject());
		expect(rafQueue.length).toBe(1);
		renderer.dispose();
	});

	it('après avoir dessiné la frame sale, zéro rAF actif au repos', () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.start();
		renderer.setProject(fakeProject());
		expect(rafQueue.length).toBe(1);

		flushOneFrame();

		expect(rafQueue.length).toBe(0);
		expect(renderer.state).toBe('idle');
		renderer.dispose();
	});

	it('un changement après le repos reprogramme une seule nouvelle frame', () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.start();
		renderer.setProject(fakeProject());
		flushOneFrame();
		expect(rafQueue.length).toBe(0);

		renderer.setQuality(512);

		expect(rafQueue.length).toBe(1);
		renderer.dispose();
	});

	it('stop() annule une frame déjà programmée', () => {
		const renderer = createRenderer(createFakeCanvas(), { resolveModule, resolveMedia });
		renderer.start();
		renderer.setProject(fakeProject());
		expect(rafQueue.length).toBe(1);

		renderer.stop();

		expect(rafQueue.length).toBe(0);
		renderer.dispose();
	});
});
