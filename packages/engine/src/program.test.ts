import { describe, expect, it } from 'vitest';
import { assembleProgram, BLEND_MODES, blendModeIndex } from './program.ts';
import type { ShaderModuleDef } from './program.ts';

// Manifeste de test — un `traitement`, donc il subit le blend. Le corps
// `ulab_main` est un stand-in : ce test vérifie l'assemblage, pas le rendu.
const TRAITEMENT_DEF: ShaderModuleDef = {
	type: 'traitement.halftone',
	category: 'traitement',
	name: 'Halftone',
	summary: 'Test',
	thumbnail: './thumbnail.webp',
	params: [
		{ key: 'frequency', label: 'Fréquence', type: 'number', min: 4, max: 200, step: 1, default: 40, unit: 'lpi' },
		{ key: 'shape', label: 'Forme', type: 'enum', options: ['point', 'ligne'], default: 'point' },
		{ key: 'invert', label: 'Inverser', type: 'boolean', default: false },
		{ key: 'tint', label: 'Teinte', type: 'color', default: '#FF6606' },
		{ key: 'center', label: 'Centre', type: 'point', default: { x: 0.5, y: 0.5 } },
		{ key: 'label', label: 'Étiquette', type: 'text', default: '' },
		{ key: 'file', label: 'Fichier', type: 'file', default: null },
		{ key: 'palette', label: 'Palette', type: 'palette', default: 'aucune' },
	],
	render: { kind: 'shader', fragment: 'vec4 ulab_main(vec4 src, vec2 uv) {\n  return src;\n}' },
};

const SOURCE_DEF: ShaderModuleDef = {
	type: 'source.image',
	category: 'source',
	name: 'Image',
	summary: 'Test',
	thumbnail: './thumbnail.webp',
	params: [{ key: 'file', label: 'Fichier', type: 'file', default: null }],
	render: { kind: 'shader', fragment: 'vec4 ulab_main(vec4 src, vec2 uv) {\n  return texture(uSource, uv);\n}' },
};

describe('assembleProgram', () => {
	it('utilise le triangle plein écran comme vertex shader', () => {
		const { vertex } = assembleProgram(TRAITEMENT_DEF);
		expect(vertex).toContain('gl_VertexID');
		expect(vertex).toContain('out vec2 vUv;');
	});

	it('déclare le préambule moteur : version, precision, uniformes toujours présents', () => {
		const { fragment } = assembleProgram(TRAITEMENT_DEF);
		expect(fragment).toContain('#version 300 es');
		expect(fragment).toContain('precision highp float;');
		expect(fragment).toContain('uniform sampler2D uSource;');
		expect(fragment).toContain('uniform vec2 uResolution;');
		expect(fragment).toContain('uniform vec2 uTexel;');
		expect(fragment).toContain('uniform float uScale;');
		expect(fragment).toContain('uniform float uTime;');
		expect(fragment).toContain('uniform int uFrame;');
		expect(fragment).toContain('uniform float uSeed;');
		expect(fragment).toContain('uniform vec2 uMediaSize;');
		expect(fragment).toContain('in vec2 vUv;');
		expect(fragment).toContain('out vec4 fragColor;');
	});

	it("génère un uniforme u_<key> par paramètre, selon son type — sauf text et file", () => {
		const { fragment } = assembleProgram(TRAITEMENT_DEF);
		expect(fragment).toContain('uniform float u_frequency;');
		expect(fragment).toContain('uniform int u_shape;');
		expect(fragment).toContain('uniform bool u_invert;');
		expect(fragment).toContain('uniform vec3 u_tint;');
		expect(fragment).toContain('uniform vec2 u_center;');
		expect(fragment).not.toContain('u_label');
		expect(fragment).not.toContain('u_file');
	});

	it("génère un tableau et un compte pour un paramètre 'palette'", () => {
		const { fragment } = assembleProgram(TRAITEMENT_DEF);
		expect(fragment).toContain('uniform vec3 u_palette[16];');
		expect(fragment).toContain('uniform int u_palette_count;');
	});

	it("inclut ulab_palette_nearest pour tout module, source ou non — utilitaire commun au préambule", () => {
		for (const def of [TRAITEMENT_DEF, SOURCE_DEF]) {
			const { fragment } = assembleProgram(def);
			expect(fragment).toContain(
				'vec3 ulab_palette_nearest(vec3 c, vec3 pal[16], int count)',
			);
		}
	});

	it('inclut ulab_blend et les uniformes de fusion pour un module non-source', () => {
		const { fragment } = assembleProgram(TRAITEMENT_DEF);
		expect(fragment).toContain('uniform int u_blendMode;');
		expect(fragment).toContain('uniform float u_blendOpacity;');
		expect(fragment).toContain('vec4 ulab_blend(vec4 src, vec4 res, int mode, float opacity)');
		expect(fragment).toContain(
			'fragColor = ulab_blend(src, res, u_blendMode, u_blendOpacity);',
		);
	});

	it('place le corps ulab_main du module tel quel', () => {
		const { fragment } = assembleProgram(TRAITEMENT_DEF);
		expect(fragment).toContain(TRAITEMENT_DEF.render.fragment);
	});

	it("exempte les modules 'source' du blend : pas d'uniformes, pas de fonction, res écrit directement", () => {
		const { fragment } = assembleProgram(SOURCE_DEF);
		expect(fragment).not.toContain('u_blendMode');
		expect(fragment).not.toContain('u_blendOpacity');
		expect(fragment).not.toContain('ulab_blend');
		expect(fragment).toContain('fragColor = res;');
	});

	it("l'ordre de BLEND_MODES fixe l'index utilisé par pipeline.ts — contrat public, jamais réordonné", () => {
		expect(BLEND_MODES).toEqual(['normal', 'multiply', 'screen', 'overlay', 'difference', 'add']);
		expect(blendModeIndex('normal')).toBe(0);
		expect(blendModeIndex('multiply')).toBe(1);
		expect(blendModeIndex('add')).toBe(5);
	});
});
