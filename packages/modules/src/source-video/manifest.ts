import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'source.video',
	category: 'source',
	name: 'Vidéo',
	summary: 'Un clip chargé depuis le disque, lu image par image.',
	thumbnail: './thumbnail.webp',
	params: [
		{ key: 'file', label: 'Fichier', type: 'file', default: null },
		{ key: 'loop', label: 'Boucle', type: 'boolean', default: true },
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
