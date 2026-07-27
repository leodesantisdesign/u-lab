import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'traitement.pixelisation',
	category: 'traitement',
	name: 'Pixellisation',
	summary: "Réduit l'image en blocs de couleur uniforme.",
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'cellSize',
			label: 'Taille de bloc',
			type: 'number',
			min: 2,
			max: 64,
			step: 1,
			default: 8,
			unit: 'px',
		},
		{
			key: 'shape',
			label: 'Forme',
			type: 'enum',
			options: ['carré', 'rond'],
			default: 'carré',
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
