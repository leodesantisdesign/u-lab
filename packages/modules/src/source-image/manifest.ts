import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'source.image',
	category: 'source',
	name: 'Image',
	summary: 'Une photo chargée depuis le disque, point de départ de la pile.',
	thumbnail: './thumbnail.webp',
	params: [
		{ key: 'file', label: 'Fichier', type: 'file', default: null },
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
