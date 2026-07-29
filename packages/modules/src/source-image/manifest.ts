import type { ModuleDef } from '../types.ts';
import fragment from './shader.glsl?raw';
import thumbnail from './thumbnail.webp?url';

export const manifest: ModuleDef = {
	type: 'source.image',
	category: 'source',
	name: 'Image',
	summary: 'Une photo chargée depuis le disque, point de départ de la pile.',
	thumbnail,
	params: [
		{ key: 'file', label: 'Fichier', type: 'file', default: null },
	],
	render: { kind: 'shader', fragment },
};
