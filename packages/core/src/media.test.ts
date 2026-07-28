import { describe, expect, it } from 'vitest';
import { MediaStore } from './media.ts';
import { DocumentStore } from './store.svelte.ts';
import type { MediaRef } from './types.ts';

function fakeRef(overrides: Partial<MediaRef> = {}): MediaRef {
	return {
		id: 'media-1',
		kind: 'image',
		name: 'photo.jpg',
		mimeType: 'image/jpeg',
		...overrides,
	};
}

describe('DocumentStore.addMedia / removeMedia', () => {
	it('adds a MediaRef to project.media and nothing else', () => {
		const store = new DocumentStore();
		const ref = fakeRef();

		store.addMedia(ref);

		expect(store.project.media).toEqual([ref]);
	});

	it('never stores anything but plain MediaRef shapes — no blob, no bitmap', () => {
		const store = new DocumentStore();
		store.addMedia(fakeRef());

		for (const entry of store.project.media) {
			expect(Object.keys(entry).sort()).toEqual(['id', 'kind', 'mimeType', 'name'].sort());
		}
	});

	it('keeps JSON.stringify(project) valid after adding a media', () => {
		const store = new DocumentStore();
		store.addMedia(fakeRef());

		expect(() => JSON.stringify(store.project)).not.toThrow();
		const restored = JSON.parse(JSON.stringify(store.project));
		expect(restored.media).toEqual(store.project.media);
	});

	it('removes a media by id', () => {
		const store = new DocumentStore();
		store.addMedia(fakeRef({ id: 'a' }));
		store.addMedia(fakeRef({ id: 'b' }));

		store.removeMedia('a');

		expect(store.project.media.map((m) => m.id)).toEqual(['b']);
	});

	it('removeMedia on an unknown id is a no-op', () => {
		const store = new DocumentStore();
		store.addMedia(fakeRef());

		store.removeMedia('does-not-exist');

		expect(store.project.media).toHaveLength(1);
	});

	it('addMedia is undoable on its own', () => {
		const store = new DocumentStore();
		store.addMedia(fakeRef());

		store.undo();

		expect(store.project.media).toHaveLength(0);
	});

	it('addMedia(ref, groupKey) followed by setParam with the same groupKey is one history entry — the one-gesture file-drop flow', () => {
		const store = new DocumentStore();
		const id = store.addModule('source.image');
		const ref = fakeRef();
		const groupKey = `${id}.file`;

		store.addMedia(ref, groupKey);
		store.setParam(id, 'file', ref.id); // setParam uses `${moduleId}.${key}` internally — same key on purpose

		expect(store.project.media).toHaveLength(1);
		expect(store.project.stack[0]?.params.file).toBe(ref.id);

		store.undo();

		expect(store.project.media).toHaveLength(0);
		expect(store.project.stack[0]?.params.file).toBeUndefined();
	});
});

describe('MediaStore', () => {
	it('returns undefined for an id it has never seen', () => {
		const media = new MediaStore();
		expect(media.get('nope')).toBeUndefined();
	});

	it('revoke and clear on an empty store do not throw', () => {
		const media = new MediaStore();
		expect(() => media.revoke('nope')).not.toThrow();
		expect(() => media.clear()).not.toThrow();
	});
});
