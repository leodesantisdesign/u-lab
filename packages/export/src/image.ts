import { createRenderer } from '@ulab/engine';
import type { MediaResolver, ModuleResolver } from '@ulab/engine';
import type { Project } from '@ulab/core';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export type ExportImageOptions = {
	width: number;
	height: number;
	format: ImageFormat;
	/** 0..1 — ignoré pour 'png' (toujours sans perte), comme le fait déjà `convertToBlob`. */
	quality?: number;
};

const MIME_TYPES: Record<ImageFormat, string> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
};

const EXTENSIONS: Record<ImageFormat, string> = {
	png: 'png',
	jpeg: 'jpg',
	webp: 'webp',
};

export function imageExtension(format: ImageFormat): string {
	return EXTENSIONS[format];
}

/**
 * Rend hors écran, à la résolution demandée — jamais celle de l'aperçu, et
 * jamais en agrandissant un rendu existant : `Renderer.renderToBitmap`
 * refait tourner tout le pipeline sur un canevas dédié, à cette taille
 * précise. Le réglage de qualité d'aperçu n'entre jamais en jeu ici.
 */
export async function exportImage(
	project: Project,
	resolvers: { resolveModule: ModuleResolver; resolveMedia: MediaResolver },
	options: ExportImageOptions,
): Promise<Blob> {
	const width = Math.max(1, Math.round(options.width));
	const height = Math.max(1, Math.round(options.height));

	// `createRenderer` exige un HTMLCanvasElement, mais `renderToBitmap` ne
	// s'en sert pas pour dessiner (il crée son propre OffscreenCanvas) — ce
	// canevas ne sert qu'à obtenir un contexte WebGL "live", jamais attaché
	// au DOM, jamais affiché.
	const throwawayCanvas = document.createElement('canvas');
	const renderer = createRenderer(throwawayCanvas, resolvers);

	try {
		const bitmap = await renderer.renderToBitmap(project, { width, height });
		try {
			return await bitmapToBlob(bitmap, width, height, options.format, options.quality);
		} finally {
			bitmap.close();
		}
	} finally {
		renderer.dispose();
	}
}

async function bitmapToBlob(
	bitmap: ImageBitmap,
	width: number,
	height: number,
	format: ImageFormat,
	quality: number | undefined,
): Promise<Blob> {
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error("Impossible d'obtenir un contexte 2D pour encoder l'export.");
	ctx.drawImage(bitmap, 0, 0);
	return canvas.convertToBlob({ type: MIME_TYPES[format], quality });
}
