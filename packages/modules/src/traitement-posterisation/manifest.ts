import type { ModuleDef } from '../types.ts';

// Plage et défaut repris de _legacy/u-dither-v1/web/src/core/fxParams.ts
// (EFFECT_META.posterize : min 0, max 16, défaut 6).
export const manifest: ModuleDef = {
	type: 'traitement.posterisation',
	category: 'traitement',
	name: 'Postérisation',
	summary: "Réduit le nombre de niveaux de ton, par bandes plutôt qu'en dégradé continu.",
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'levels',
			label: 'Niveaux',
			type: 'number',
			min: 2,
			max: 16,
			step: 1,
			default: 6,
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
