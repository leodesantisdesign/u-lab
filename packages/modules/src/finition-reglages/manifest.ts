import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

// Plages reprises de _legacy/u-dither-v1/web/src/core/imageAdjustParams.ts —
// c'est le seul endroit du catalogue où corriger les tons (règle 1, voir
// ETAPE-2.md §2 : "un module de tramage qui corrige aussi les tons est un
// fourre-tout"). Pas de paramètre 'inverser' ici : l'inversion appartient
// aux modules de tramage, où elle inverse la trame, pas l'image.
export const manifest: ModuleDef = {
	type: 'finition.reglages',
	category: 'finition',
	name: 'Réglages',
	summary: 'Luminosité, contraste, gamma, saturation. À placer avant un tramage.',
	thumbnail,
	params: [
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
			key: 'contrast',
			label: 'Contraste',
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
			step: 0.05,
			default: 1,
		},
		{
			key: 'saturation',
			label: 'Saturation',
			type: 'number',
			min: -100,
			max: 100,
			step: 1,
			default: 0,
			unit: '%',
		},
	],
	render: { kind: 'shader', fragment },
};
