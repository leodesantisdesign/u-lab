import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'traitement.ascii',
	category: 'traitement',
	name: 'ASCII',
	summary: "Remplace les blocs de tons par des caractères, à la manière d'un terminal.",
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'cellSize',
			label: 'Taille de cellule',
			type: 'number',
			min: 4,
			max: 32,
			step: 1,
			default: 10,
			unit: 'px',
		},
		{
			key: 'charset',
			label: 'Jeu de caractères',
			type: 'enum',
			options: ['dense', 'clairsemé', 'binaire'],
			default: 'dense',
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
		{ key: 'color', label: 'Couleur source', type: 'boolean', default: false },
	],
	// La correspondance ton → glyphe se fait par table de correspondance dans
	// un fragment shader, cf. l'article Codrops cité dans ARCHITECTURE.md §8.
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
