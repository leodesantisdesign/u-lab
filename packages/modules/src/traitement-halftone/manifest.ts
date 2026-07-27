import type { ModuleDef } from '../types.ts';

// Manifeste tel que donné en exemple canonique dans
// docs/U.LAB-ARCHITECTURE.md §4 — repris à l'identique.
export const manifest: ModuleDef = {
	type: 'traitement.halftone',
	category: 'traitement',
	name: 'Halftone',
	summary: "Trame d'impression : points, lignes, angle, fréquence.",
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'frequency',
			label: 'Fréquence',
			type: 'number',
			min: 4,
			max: 200,
			step: 1,
			default: 40,
			unit: 'lpi',
		},
		{
			key: 'angle',
			label: 'Angle',
			type: 'number',
			min: 0,
			max: 180,
			step: 1,
			default: 45,
			unit: '°',
		},
		{
			key: 'shape',
			label: 'Forme',
			type: 'enum',
			options: ['point', 'ligne', 'losange', 'carré'],
			default: 'point',
		},
		{
			key: 'sharpness',
			label: 'Netteté',
			type: 'number',
			min: 0,
			max: 1,
			step: 0.01,
			default: 0.5,
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
