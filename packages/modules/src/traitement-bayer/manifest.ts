import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

// Bayer et Dither sont deux modules distincts, jamais un menu déroulant
// partagé : deux esthétiques et deux chemins de calcul (ETAPE-2.md, prompt
// 8 — c'est la faute que u.dither v1 avait commise). Ne reprend pas
// contrast/brightness/gamma du legacy (finition.reglages), ni colorMode
// (mono + palette le couvre), ni les matrices "croix"/"losange"/"lignes"
// (ce ne sont pas des matrices de Bayer).
export const manifest: ModuleDef = {
	type: 'traitement.bayer',
	category: 'traitement',
	name: 'Bayer',
	summary:
		'Tramage ordonné : une matrice de seuils fixe, un motif géométrique régulier. La trame des écrans 1 bit.',
	thumbnail,
	params: [
		{
			key: 'matrix',
			label: 'Matrice',
			type: 'enum',
			options: ['2×2', '4×4', '8×8'],
			default: '8×8',
		},
		{
			key: 'scale',
			label: 'Échelle',
			type: 'number',
			min: 1,
			max: 16,
			step: 1,
			default: 4,
			unit: 'px',
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
	render: { kind: 'shader', fragment },
};
