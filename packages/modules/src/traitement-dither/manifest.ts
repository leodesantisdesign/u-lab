import type { ModuleDef } from '../types.ts';

// Plages et défauts repris de _legacy/u-dither-v1/web/src/core/diffusionParams.ts
// (FLOYD_DEFAULTS / ATKINSON_DEFAULTS), éprouvés à l'usage sur u.dither v1.
export const manifest: ModuleDef = {
	type: 'traitement.dither',
	category: 'traitement',
	name: 'Dither',
	summary: 'Tramage par diffusion d\'erreur (Floyd–Steinberg, Atkinson).',
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'algorithm',
			label: 'Algorithme',
			type: 'enum',
			options: ['floyd-steinberg', 'atkinson'],
			default: 'floyd-steinberg',
		},
		{
			key: 'levels',
			label: 'Niveaux',
			type: 'number',
			min: 2,
			max: 8,
			step: 1,
			default: 2,
		},
		{
			key: 'contrast',
			label: 'Contraste',
			type: 'number',
			min: -50,
			max: 50,
			step: 1,
			default: 12,
			unit: '%',
		},
		{
			key: 'brightness',
			label: 'Luminosité',
			type: 'number',
			min: -50,
			max: 50,
			step: 1,
			default: 0,
			unit: '%',
		},
		{
			key: 'gamma',
			label: 'Gamma',
			type: 'number',
			min: 0.4,
			max: 3,
			step: 0.01,
			default: 1,
		},
		{ key: 'serpentine', label: 'Balayage serpentin', type: 'boolean', default: true },
		{ key: 'invert', label: 'Inverser', type: 'boolean', default: false },
	],
	// Séquentiel (chaque pixel dépend du voisin déjà traité) : chemin Worker,
	// jamais un fragment shader classique. Voir CLAUDE.md §2.
	render: { kind: 'worker', fragment: '// TODO(Étape 2)' },
};
