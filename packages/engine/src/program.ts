// `import type` uniquement — ETAPE-2.md §3.5 : le moteur ne fait jamais un
// import de valeur depuis @ulab/modules, pour qu'aucun cycle n'existe à
// l'exécution.
import type { ModuleDef, ParamDef } from '@ulab/modules';
import type { BlendMode } from '@ulab/core';
import { QUAD_VERTEX_SHADER } from './quad.ts';

/**
 * Ordre des modes de fusion : c'est un contrat entre ce fichier (le GLSL de
 * `ulab_blend`) et pipeline.ts (l'uniforme entier envoyé au GPU). Comme pour
 * les options d'un `enum` de paramètre, cet ordre ne se réordonne pas — on
 * complète par la fin.
 */
export const BLEND_MODES: readonly BlendMode[] = [
	'normal',
	'multiply',
	'screen',
	'overlay',
	'difference',
	'add',
];

export function blendModeIndex(mode: BlendMode): number {
	const index = BLEND_MODES.indexOf(mode);
	return index === -1 ? 0 : index;
}

// ETAPE-2.md §3.1 ferme la liste à uSource/uResolution/uTexel/uTime/uFrame/
// uSeed. `uMediaSize` s'y ajoute pour le prompt 2 : le cadrage "contain" de
// source.image a besoin de la résolution native du média, et §3.1 dit
// explicitement que le type 'file' n'est "jamais transmis à un shader" — un
// module ne peut donc pas se la fournir lui-même en uniforme dérivé d'un
// paramètre. C'est une capacité de moteur (§8 : « la capacité manque au
// moteur, elle remonte dans packages/engine, elle ne descend pas dans le
// module »). Toujours présent, (0,0) quand aucun média n'est résolu — les
// modules qui n'en ont pas besoin l'ignorent, sans coût.
const ENGINE_PREAMBLE = `#version 300 es
precision highp float;

uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uTexel;
uniform float uTime;
uniform int uFrame;
uniform float uSeed;
uniform vec2 uMediaSize;

in vec2 vUv;
out vec4 fragColor;
`;

const BLEND_UNIFORMS = `uniform int u_blendMode;
uniform float u_blendOpacity;
`;

// Les six modes de BlendMode (architecture §3). L'index de branche suit
// BLEND_MODES ci-dessus, pas l'ordre alphabétique.
const ULAB_BLEND_FUNCTION = `vec3 ulab_blend_mode(vec3 src, vec3 res, int mode) {
  if (mode == 1) { // multiply
    return src * res;
  } else if (mode == 2) { // screen
    return 1.0 - (1.0 - src) * (1.0 - res);
  } else if (mode == 3) { // overlay
    return mix(2.0 * src * res, 1.0 - 2.0 * (1.0 - src) * (1.0 - res), step(0.5, src));
  } else if (mode == 4) { // difference
    return abs(src - res);
  } else if (mode == 5) { // add
    return min(src + res, 1.0);
  }
  return res; // normal (0), et repli pour tout index inconnu
}

vec4 ulab_blend(vec4 src, vec4 res, int mode, float opacity) {
  vec3 blended = ulab_blend_mode(src.rgb, res.rgb, mode);
  return vec4(mix(src.rgb, blended, opacity), mix(src.a, res.a, opacity));
}
`;

const EPILOGUE_WITH_BLEND = `void main() {
  vec4 src = texture(uSource, vUv);
  vec4 res = ulab_main(src, vUv);
  fragColor = ulab_blend(src, res, u_blendMode, u_blendOpacity);
}
`;

// ETAPE-2.md §3.2 : les modules `source` écrivent `res` directement, leur
// `blend` n'a pas de sens.
const EPILOGUE_SOURCE = `void main() {
  vec4 src = texture(uSource, vUv);
  vec4 res = ulab_main(src, vUv);
  fragColor = res;
}
`;

/**
 * Un uniforme par paramètre, nommé `u_<key>` (ETAPE-2.md §3.1). `text` et
 * `file` ne sont jamais transmis à un shader : aucun uniforme n'est déclaré
 * pour eux.
 */
function paramUniformDeclaration(param: ParamDef): string | null {
	switch (param.type) {
		case 'number':
			return `uniform float u_${param.key};`;
		case 'boolean':
			return `uniform bool u_${param.key};`;
		case 'enum':
			return `uniform int u_${param.key};`;
		case 'color':
			return `uniform vec3 u_${param.key};`;
		case 'point':
			return `uniform vec2 u_${param.key};`;
		case 'text':
		case 'file':
			return null;
		default: {
			// Exhaustivité : si un type de paramètre est ajouté au vocabulaire
			// commun (ex. 'palette', ETAPE-2.md §3.4) sans mettre ce switch à
			// jour, le build échoue ici plutôt que de silencieusement ignorer
			// le nouveau type.
			const exhaustive: never = param;
			throw new Error(`Type de paramètre non géré par l'assembleur de programme : ${JSON.stringify(exhaustive)}`);
		}
	}
}

function paramUniformBlock(params: ParamDef[]): string {
	const declarations = params.map(paramUniformDeclaration).filter((line): line is string => line !== null);
	return declarations.length > 0 ? `${declarations.join('\n')}\n` : '';
}

export type AssembledProgram = {
	vertex: string;
	fragment: string;
};

/**
 * Assemble le programme complet autour de la fonction `ulab_main` fournie
 * par le module (ETAPE-2.md §3.1 et §3.2) :
 * préambule moteur + uniformes du manifeste + `ulab_blend` (sauf source) +
 * corps du module + épilogue `main()`.
 */
export function assembleProgram(def: ModuleDef): AssembledProgram {
	const isSource = def.category === 'source';
	const parts = [ENGINE_PREAMBLE, paramUniformBlock(def.params)];

	if (!isSource) parts.push(BLEND_UNIFORMS, ULAB_BLEND_FUNCTION);

	parts.push(def.render.fragment);
	parts.push(isSource ? EPILOGUE_SOURCE : EPILOGUE_WITH_BLEND);

	return {
		vertex: QUAD_VERTEX_SHADER,
		fragment: parts.join('\n'),
	};
}
