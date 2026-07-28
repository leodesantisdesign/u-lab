import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';

// Paramètres portés de _legacy/u-dither-v1/web/src/core/halftoneParams.ts
// pour la parité u.dither (ETAPE-2.md, prompt 2). 'frequency'/'sharpness'
// (exemple canonique de l'architecture §4) disparaissent au profit de
// 'cellSize'/'roundness' — voir CLAUDE.md §7 pour la décision. 'gamma',
// 'contrast' et 'colorMode' du legacy ne reviennent pas : ce ne sont plus
// des paramètres de ce module. 'palette' arrive en vague B.
export const manifest: ModuleDef = {
	type: 'traitement.halftone',
	category: 'traitement',
	name: 'Halftone',
	summary: "Trame d'impression : points, lignes, angle, cellule.",
	thumbnail: './thumbnail.webp',
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
			key: 'minDot',
			label: 'Point minimum',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 8,
			unit: '%',
		},
		{
			key: 'shape',
			label: 'Forme',
			type: 'enum',
			options: ['rond', 'carré', 'carré arrondi'],
			default: 'rond',
		},
		{
			key: 'roundness',
			label: 'Arrondi',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 60,
			unit: '%',
		},
		{
			key: 'jitter',
			label: 'Gigue',
			type: 'number',
			min: 0,
			max: 100,
			step: 1,
			default: 6,
			unit: '%',
		},
		{
			key: 'stretch',
			label: 'Étirement',
			type: 'number',
			min: 60,
			max: 160,
			step: 1,
			default: 100,
			unit: '%',
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
	],
	render: { kind: 'shader', fragment },
};
