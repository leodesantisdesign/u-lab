// En mémoire uniquement à cette étape (Étape 2) : MediaStore ne persiste
// rien. Recharger la page perd tous les médias ajoutés. La persistance
// IndexedDB arrive à l'Étape 3 (docs/ETAPE-2.md §2) — ce fichier sera alors
// le seul à changer, le document (MediaRef) ne bouge pas.

import type { MediaRef } from './types.ts';

type MediaEntry = {
	blob: Blob;
	bitmap: ImageBitmap;
};

/**
 * Le blob et le bitmap décodé d'un média, tenus hors du document (architecture
 * §3, principe 1 : le document est sérialisable, jamais un handle GPU ou un
 * blob dedans). Le document ne référence un média que par son `MediaRef.id`.
 */
export class MediaStore {
	private readonly entries = new Map<string, MediaEntry>();

	async add(file: File): Promise<MediaRef> {
		const bitmap = await createImageBitmap(file);
		const id = crypto.randomUUID();
		this.entries.set(id, { blob: file, bitmap });
		return {
			id,
			kind: 'image',
			name: file.name,
			mimeType: file.type,
		};
	}

	get(id: string): MediaEntry | undefined {
		return this.entries.get(id);
	}

	revoke(id: string): void {
		const entry = this.entries.get(id);
		if (!entry) return;
		entry.bitmap.close();
		this.entries.delete(id);
	}

	clear(): void {
		for (const entry of this.entries.values()) entry.bitmap.close();
		this.entries.clear();
	}
}
