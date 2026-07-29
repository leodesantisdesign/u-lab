import { beforeAll, describe, expect, it } from 'vitest';
import process from './worker.ts';

// `ImageData` est une API navigateur/Worker, absente de Node : `process()`
// en construit une en sortie via `new ImageData(...)`, donc le global doit
// exister avant l'appel — peu importe qu'il ne fasse QUE ce que ce fichier
// utilise réellement.
class FakeImageData {
	data: Uint8ClampedArray;
	width: number;
	height: number;
	constructor(data: Uint8ClampedArray, width: number, height?: number) {
		this.data = data;
		this.width = width;
		this.height = height ?? data.length / (4 * width);
	}
}

beforeAll(() => {
	(globalThis as unknown as { ImageData: unknown }).ImageData = FakeImageData;
});

const CTX = { seed: 0, time: 0, scale: 1 };

function solidImage(width: number, height: number, r: number, g: number, b: number, a = 255): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = r;
		data[i * 4 + 1] = g;
		data[i * 4 + 2] = b;
		data[i * 4 + 3] = a;
	}
	return new FakeImageData(data, width, height) as unknown as ImageData;
}

function midGrayImage(size: number): ImageData {
	return solidImage(size, size, 128, 128, 128);
}

function uniqueRgbTriplets(image: ImageData): Set<string> {
	const seen = new Set<string>();
	for (let i = 0; i < image.data.length; i += 4) {
		seen.add(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`);
	}
	return seen;
}

describe('process — sans palette (niveaux de gris)', () => {
	it('un noir plein reste noir, un blanc plein reste blanc (levels=2)', () => {
		const black = process(solidImage(8, 8, 0, 0, 0), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		const white = process(solidImage(8, 8, 255, 255, 255), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		expect(uniqueRgbTriplets(black)).toEqual(new Set(['0,0,0']));
		expect(uniqueRgbTriplets(white)).toEqual(new Set(['255,255,255']));
	});

	it('un gris moyen à levels=2 se disperse en noir ET blanc — c’est la diffusion, pas un simple seuil', () => {
		const out = process(midGrayImage(24), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		const colors = uniqueRgbTriplets(out);
		expect(colors.has('0,0,0')).toBe(true);
		expect(colors.has('255,255,255')).toBe(true);
		expect(colors.size).toBe(2); // rien d'autre à levels=2
	});

	it('floyd-steinberg et atkinson produisent des textures différentes sur la même entrée', () => {
		const fs = process(midGrayImage(24), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		const atkinson = process(midGrayImage(24), { algorithm: 'atkinson', levels: 2, invert: false, palette: 'aucune' }, CTX);
		expect(Array.from(fs.data)).not.toEqual(Array.from(atkinson.data));
	});

	it('invert bascule la tendance sombre/claire', () => {
		// Une image très sombre à invert=false doit rester presque toute noire ;
		// à invert=true, elle doit bien plus dériver vers le blanc.
		const dark = solidImage(24, 24, 30, 30, 30);
		const countWhite = (img: ImageData) => {
			let n = 0;
			for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === 255) n++;
			return n;
		};
		const normal = process(dark, { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		const inverted = process(dark, { algorithm: 'floyd-steinberg', levels: 2, invert: true, palette: 'aucune' }, CTX);
		expect(countWhite(inverted)).toBeGreaterThan(countWhite(normal));
	});

	it('respecte `levels` : au plus `levels` niveaux de gris distincts en sortie', () => {
		const out = process(midGrayImage(32), { algorithm: 'floyd-steinberg', levels: 4, invert: false, palette: 'aucune' }, CTX);
		const grays = new Set<number>();
		for (let i = 0; i < out.data.length; i += 4) grays.add(out.data[i] ?? 0);
		expect(grays.size).toBeLessThanOrEqual(4);
	});

	it('conserve le canal alpha tel quel', () => {
		const src = solidImage(4, 4, 128, 128, 128, 137);
		const out = process(src, { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(137);
	});

	it('est déterministe : même entrée, même sortie, à chaque appel', () => {
		const a = process(midGrayImage(24), { algorithm: 'atkinson', levels: 3, invert: false, palette: 'aucune' }, CTX);
		const b = process(midGrayImage(24), { algorithm: 'atkinson', levels: 3, invert: false, palette: 'aucune' }, CTX);
		expect(Array.from(a.data)).toEqual(Array.from(b.data));
	});

	it('ne change pas les dimensions', () => {
		const out = process(midGrayImage(17), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'aucune' }, CTX);
		expect(out.width).toBe(17);
		expect(out.height).toBe(17);
	});
});

describe('process — avec palette (point non négociable de U.LAB-TRAMAGE.md §5)', () => {
	it('chaque pixel de sortie est EXACTEMENT une couleur de la palette — jamais un gris mappé après coup', () => {
		const gameboy = new Set(['15,56,15', '48,98,48', '139,172,15', '155,188,15']);
		const out = process(midGrayImage(24), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'gameboy' }, CTX);
		const colors = uniqueRgbTriplets(out);
		for (const color of colors) expect(gameboy.has(color)).toBe(true);
		// Et la diffusion doit réellement utiliser plusieurs couleurs de la
		// palette sur un dégradé, pas s'effondrer sur une seule.
		expect(colors.size).toBeGreaterThan(1);
	});

	it("ignore 'levels' quand une palette est active", () => {
		const withLevels2 = process(midGrayImage(24), { algorithm: 'floyd-steinberg', levels: 2, invert: false, palette: 'gameboy' }, CTX);
		const withLevels8 = process(midGrayImage(24), { algorithm: 'floyd-steinberg', levels: 8, invert: false, palette: 'gameboy' }, CTX);
		expect(Array.from(withLevels2.data)).toEqual(Array.from(withLevels8.data));
	});
});
