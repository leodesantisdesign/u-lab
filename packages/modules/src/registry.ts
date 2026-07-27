import { manifest as sourceImage } from './source-image/manifest.ts';
import { manifest as sourceVideo } from './source-video/manifest.ts';
import { manifest as sourceWebcam } from './source-webcam/manifest.ts';
import { manifest as sourceCouleur } from './source-couleur/manifest.ts';
import { manifest as traitementDither } from './traitement-dither/manifest.ts';
import { manifest as traitementHalftone } from './traitement-halftone/manifest.ts';
import { manifest as traitementAscii } from './traitement-ascii/manifest.ts';
import { manifest as traitementPixelisation } from './traitement-pixelisation/manifest.ts';
import { manifest as traitementPosterisation } from './traitement-posterisation/manifest.ts';
import { manifest as finitionGrain } from './finition-grain/manifest.ts';
import { manifest as finitionVignette } from './finition-vignette/manifest.ts';
import { manifest as finitionScanlines } from './finition-scanlines/manifest.ts';
import { manifest as finitionAberration } from './finition-aberration/manifest.ts';
import type { ModuleCategory, ModuleDef } from './types.ts';

export const MODULES: ModuleDef[] = [
	sourceImage,
	sourceVideo,
	sourceWebcam,
	sourceCouleur,
	traitementDither,
	traitementHalftone,
	traitementAscii,
	traitementPixelisation,
	traitementPosterisation,
	finitionGrain,
	finitionVignette,
	finitionScanlines,
	finitionAberration,
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
