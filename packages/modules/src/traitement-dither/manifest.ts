import type { ModuleDef } from '../types.ts';
import DitherWorker from './worker.entry.ts?worker';
import thumbnail from './thumbnail.webp?url';

// Manifeste final avant gel des clés (étape 3) — docs/ETAPE-2.md §2 : le
// legacy perd contrast/brightness/gamma (un seul endroit pour la
// correction de tons désormais : finition.reglages) et serpentine (câblé en
// dur dans worker.ts, ce n'est pas un arbitrage à faire porter à
// l'utilisateur — il est simplement meilleur).
export const manifest: ModuleDef = {
	type: 'traitement.dither',
	category: 'traitement',
	name: 'Dither',
	summary: "Diffusion d'erreur : l'erreur de chaque pixel est reportée sur ses voisins. Le grain organique du Macintosh 1 bit.",
	thumbnail,
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
			key: 'invert',
			label: 'Inverser',
			type: 'boolean',
			default: false,
		},
		{
			key: 'palette',
			label: 'Palette',
			type: 'palette',
			default: 'aucune',
		},
	],
	// Séquentiel (chaque pixel dépend du voisin déjà traité) : chemin Worker,
	// jamais un fragment shader classique (CLAUDE.md §2).
	render: { kind: 'worker', worker: DitherWorker },
};
