import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'source.couleur',
	category: 'source',
	name: 'Couleur / Dégradé',
	summary: 'Un aplat ou un dégradé linéaire entre deux couleurs, sans média externe.',
	thumbnail: './thumbnail.webp',
	params: [
		{ key: 'colorA', label: 'Couleur A', type: 'color', default: '#0A0A09' },
		{ key: 'colorB', label: 'Couleur B', type: 'color', default: '#FF6606' },
		{
			key: 'angle',
			label: 'Angle',
			type: 'number',
			min: 0,
			max: 360,
			step: 1,
			default: 0,
			unit: '°',
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
