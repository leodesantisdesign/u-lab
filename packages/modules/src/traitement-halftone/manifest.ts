import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

// Manifeste final avant gel des clés (étape 3) — docs/ETAPE-2.md §2 et
// docs/U.LAB-TRAMAGE.md §4 (le test des 8 secondes) : minDot, jitter,
// stretch et roundness sont retirés, ce sont des micro-réglages d'expert
// qui ne se voient pas dans une boucle de huit secondes.
//
// L'ordre des options de 'shape' est un contrat public (ETAPE-2.md §3.1) :
// on complète par la fin, jamais par le milieu.
export const manifest: ModuleDef = {
	type: 'traitement.halftone',
	category: 'traitement',
	name: 'Halftone',
	summary: "Trame d'impression : une grille de points dont la taille varie.",
	thumbnail,
	params: [
		{
			key: 'cellSize',
			label: 'Taille de cellule',
			type: 'number',
			min: 4,
			max: 80,
			step: 1,
			default: 18,
			unit: 'px',
		},
		{
			key: 'dotSize',
			label: 'Taille du point',
			type: 'number',
			min: 20,
			max: 130,
			step: 1,
			default: 96,
			unit: '%',
		},
		{
			key: 'shape',
			label: 'Forme',
			type: 'enum',
			options: ['rond', 'carré', 'losange', 'ligne'],
			default: 'rond',
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
	render: { kind: 'shader', fragment },
};
