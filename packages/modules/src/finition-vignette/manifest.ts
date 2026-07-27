import type { ModuleDef } from '../types.ts';

// Plage et défaut (28) repris de fxParams.ts (EFFECT_META.vignette).
export const manifest: ModuleDef = {
	type: 'finition.vignette',
	category: 'finition',
	name: 'Vignette',
	summary: 'Assombrit les bords pour recentrer le regard sur le sujet.',
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'amount',
			label: 'Intensité',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 28,
			unit: '%',
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
