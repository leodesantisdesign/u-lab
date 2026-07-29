import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

// Plage reprise de _legacy/u-dither-v1/web/src/core/fxParams.ts
// (EFFECT_META.posterize : défaut 6), bornée à 2 min (ETAPE-2.md, prompt 10)
// plutôt que 0 — en dessous de 2 niveaux il n'y a plus d'image.
// Pas de palette (ETAPE-2.md §2) : c'est le témoin du catalogue, il montre
// ce que le tramage évite plutôt que de faire le travail des trois autres.
export const manifest: ModuleDef = {
	type: 'traitement.posterisation',
	category: 'traitement',
	name: 'Postérisation',
	summary: 'Réduction du nombre de tons, sans tramage. Ce sont les bandes que les autres évitent.',
	thumbnail,
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
	render: { kind: 'shader', fragment },
};
