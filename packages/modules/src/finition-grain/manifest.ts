import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

// Plage reprise de _legacy/u-dither-v1/web/src/core/fxParams.ts
// (EFFECT_META.grain : 0-100). Le défaut utilise defaultAmount (16), pas le
// FX_DEFAULTS à 0 de l'ancien panneau bolt-on : ici l'ajout du module EST
// le geste qui l'active, il doit donc produire un résultat visible.
export const manifest: ModuleDef = {
	type: 'finition.grain',
	category: 'finition',
	name: 'Grain',
	summary: 'Grain de pellicule monochrome, superposé sans transformer le reste.',
	thumbnail,
	params: [
		{
			key: 'amount',
			label: 'Intensité',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 16,
			unit: '%',
		},
	],
	render: { kind: 'shader', fragment },
};
