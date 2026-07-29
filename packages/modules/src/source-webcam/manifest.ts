import type { ModuleDef } from '../types.ts';

export const manifest: ModuleDef = {
	type: 'source.webcam',
	category: 'source',
	name: 'Webcam',
	summary: 'Flux vidéo en direct depuis une caméra connectée.',
	thumbnail: './thumbnail.webp',
	// Le choix du périphérique dépend des caméras réellement branchées au
	// moment de l'exécution : une liste dynamique, pas un `enum` du manifeste.
	// Il sera exposé par l'éditeur, pas déclaré ici.
	params: [],
	render: { kind: 'shader', fragment: '// TODO(Étape 4)' },
	// Annonce l'étape 4 (ETAPE-2.md §2) : visible dans le modal, grisé,
	// « bientôt » — pas masqué.
	comingSoon: true,
};
