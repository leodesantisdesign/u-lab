import type { ModuleDef } from '../types.ts';

// Plage et défaut (18) repris de fxParams.ts (EFFECT_META.scanlines).
export const manifest: ModuleDef = {
	type: 'finition.scanlines',
	category: 'finition',
	name: 'Scanlines',
	summary: 'Assombrit une ligne sur deux, texture écran cathodique.',
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'amount',
			label: 'Intensité',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 18,
			unit: '%',
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
