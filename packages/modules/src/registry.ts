import { manifest as sourceImage } from './source-image/manifest.ts';
import { manifest as sourceVideo } from './source-video/manifest.ts';
import { manifest as sourceWebcam } from './source-webcam/manifest.ts';
import { manifest as traitementHalftone } from './traitement-halftone/manifest.ts';
import { manifest as traitementBayer } from './traitement-bayer/manifest.ts';
import { manifest as traitementDither } from './traitement-dither/manifest.ts';
import { manifest as traitementPosterisation } from './traitement-posterisation/manifest.ts';
import { manifest as traitementPixelisation } from './traitement-pixelisation/manifest.ts';
import { manifest as finitionReglages } from './finition-reglages/manifest.ts';
import { manifest as finitionGrain } from './finition-grain/manifest.ts';
import type { ModuleCategory, ModuleDef } from './types.ts';

// traitement.ascii, finition.vignette, finition.scanlines et
// finition.aberration ont leur dossier et leur manifeste, mais restent hors
// du tableau MODULES : reportés à l'étape 6 (docs/ETAPE-2.md §2) — l'ASCII
// seul (troisième famille à part entière, attend un atlas de glyphes fait
// correctement), les trois autres en bloc (famille CRT/vidéo analogique,
// cohérente entre elle, incohérente avec la trame). Ils reviendront tels
// quels : ne pas les supprimer, ne pas les étendre en attendant.
//
// source.couleur a aussi son dossier hors du tableau : son manifeste
// déclarait encore `fragment: '// TODO(Étape 2)'`, jamais implémenté —
// il ne rend rien de correct aujourd'hui, donc il sort comme les autres
// plutôt que d'apparaître cassé dans le modal.

export const MODULES: ModuleDef[] = [
	sourceImage,
	sourceVideo,
	sourceWebcam,
	traitementHalftone,
	traitementBayer,
	traitementDither,
	traitementPosterisation,
	traitementPixelisation,
	finitionReglages,
	finitionGrain,
];

export function all(): ModuleDef[] {
	return MODULES;
}

export function byType(type: string): ModuleDef | undefined {
	return MODULES.find((module) => module.type === type);
}

export function byCategory(category: ModuleCategory): ModuleDef[] {
	return MODULES.filter((module) => module.category === category);
}
