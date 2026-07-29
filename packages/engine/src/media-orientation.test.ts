import { describe, expect, it } from 'vitest';
import type { ModuleInstance } from '@ulab/core';
import type { ModuleDef } from '@ulab/modules';
import { Pipeline } from './pipeline.ts';

/**
 * Non-régression du flip vertical du média (juillet 2026).
 *
 * Un ImageBitmap est rangé première ligne = HAUT ; `vUv` (quad.ts) a son
 * origine en BAS à gauche. Il faut donc armer `UNPACK_FLIP_Y_WEBGL` autour du
 * `texImage2D` du média — et UNIQUEMENT autour de lui, parce que le drapeau est
 * global au contexte GL et que le chemin worker est déjà cohérent sans lui.
 *
 * Ce test verrouille les deux moitiés de cette phrase : le flip est armé au bon
 * endroit, et il est désarmé avant de pouvoir contaminer quoi que ce soit.
 */

const UNPACK_FLIP_Y_WEBGL = 0x9240;

type Call =
	| { fn: 'pixelStorei'; pname: number; value: boolean }
	// `sized` = forme à 9 arguments (largeur/hauteur explicites) : FBO ping-pong
	// et texture de repli, aucune image du monde extérieur.
	// `domSource` = forme à 6 arguments : le média, ou un résultat de worker.
	| { fn: 'texImage2D'; form: 'sized' | 'domSource' };

function createRecordingGL(calls: Call[]): WebGL2RenderingContext {
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
		DITHER: 21,
		UNPACK_FLIP_Y_WEBGL,
		drawingBufferWidth: 64,
		drawingBufferHeight: 64,

		disable: () => {},

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
		deleteTexture: () => {},
		activeTexture: () => {},

		pixelStorei: (pname: number, value: boolean) => {
			calls.push({ fn: 'pixelStorei', pname, value });
		},
		// On distingue par l'ARITÉ, pas par le dernier argument : la texture de
		// repli utilise la forme à 9 arguments avec un Uint8Array final, qu'un test
		// "dernier argument non nul = image" confondrait avec le média.
		texImage2D: (...args: unknown[]) => {
			calls.push({ fn: 'texImage2D', form: args.length === 6 ? 'domSource' : 'sized' });
		},

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

const SOURCE_DEF: ModuleDef = {
	type: 'source.image',
	category: 'source',
	name: 'Image',
	summary: 'Test',
	thumbnail: './thumbnail.webp',
	params: [{ key: 'file', label: 'Fichier', type: 'file', default: null }],
	render: { kind: 'shader', fragment: 'vec4 ulab_main(vec4 src, vec2 uv) { return src; }' },
};

const INSTANCE: ModuleInstance = {
	id: 'm1',
	type: 'source.image',
	enabled: true,
	params: { file: 'media-1' },
	blend: { mode: 'normal', opacity: 1 },
};

/** Un ImageBitmap suffisant pour le pipeline : il n'en lit que width/height. */
function fakeBitmap(): ImageBitmap {
	return { width: 800, height: 600, close: () => {} } as unknown as ImageBitmap;
}

function renderOnce(calls: Call[], bitmap: ImageBitmap): void {
	const pipeline = new Pipeline(createRecordingGL(calls));
	pipeline.resize(64, 64);
	pipeline.render(
		[INSTANCE],
		(type) => (type === SOURCE_DEF.type ? SOURCE_DEF : undefined),
		() => bitmap,
		{ time: 0, frame: 0, documentWidth: 64 },
	);
}

describe("orientation du média — UNPACK_FLIP_Y_WEBGL n'est armé qu'à l'upload du média", () => {
	it('arme le flip juste avant le texImage2D du média', () => {
		const calls: Call[] = [];
		renderOnce(calls, fakeBitmap());

		const uploadIndex = calls.findIndex(
			(call) => call.fn === 'texImage2D' && call.form === 'domSource',
		);
		expect(uploadIndex, "le média n'a jamais été téléversé").toBeGreaterThan(-1);

		const before = calls[uploadIndex - 1];
		expect(before).toEqual({ fn: 'pixelStorei', pname: UNPACK_FLIP_Y_WEBGL, value: true });
	});

	it('désarme le flip juste après, pour ne pas contaminer le chemin worker', () => {
		const calls: Call[] = [];
		renderOnce(calls, fakeBitmap());

		const uploadIndex = calls.findIndex(
			(call) => call.fn === 'texImage2D' && call.form === 'domSource',
		);
		const after = calls[uploadIndex + 1];
		expect(after).toEqual({ fn: 'pixelStorei', pname: UNPACK_FLIP_Y_WEBGL, value: false });
	});

	it('ne laisse jamais le flip armé à la fin du rendu', () => {
		const calls: Call[] = [];
		renderOnce(calls, fakeBitmap());

		const flips = calls.filter(
			(call): call is Extract<Call, { fn: 'pixelStorei' }> =>
				call.fn === 'pixelStorei' && call.pname === UNPACK_FLIP_Y_WEBGL,
		);
		expect(flips.length).toBeGreaterThan(0);
		expect(flips.at(-1)?.value).toBe(false);
	});

	it("n'arme aucun flip quand aucun média n'est résolu (texture de repli)", () => {
		const calls: Call[] = [];
		const pipeline = new Pipeline(createRecordingGL(calls));
		pipeline.resize(64, 64);
		pipeline.render(
			[INSTANCE],
			(type) => (type === SOURCE_DEF.type ? SOURCE_DEF : undefined),
			() => undefined,
			{ time: 0, frame: 0, documentWidth: 64 },
		);

		const flips = calls.filter(
			(call) => call.fn === 'pixelStorei' && call.pname === UNPACK_FLIP_Y_WEBGL,
		);
		expect(flips).toEqual([]);
	});
});
