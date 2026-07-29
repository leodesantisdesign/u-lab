import { describe, expect, it } from 'vitest';
import { all, byName, nearest, toFloat3 } from './index.ts';

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe('all', () => {
	it('lists exactly six palettes — signed, not a generator', () => {
		expect(all().map((p) => p.name)).toEqual([
			'aucune',
			'macintosh',
			'gameboy',
			'cga',
			'warm_print',
			'acid_orange',
		]);
	});
});

describe('byName', () => {
	it('resolves every palette by its key', () => {
		for (const palette of all()) {
			expect(byName(palette.name)).toBe(palette);
		}
	});

	it('returns undefined for an unknown name', () => {
		expect(byName('pico8')).toBeUndefined();
		expect(byName('custom')).toBeUndefined();
		expect(byName('')).toBeUndefined();
	});
});

describe('palette shapes', () => {
	it("'aucune' has exactly zero colors — the grayscale sentinel", () => {
		expect(byName('aucune')?.colors).toHaveLength(0);
	});

	it('every real palette has between 2 and 16 colors, all valid hex', () => {
		const realPalettes = all().filter((p) => p.name !== 'aucune');
		expect(realPalettes.length).toBeGreaterThan(0);
		for (const palette of realPalettes) {
			expect(palette.colors.length).toBeGreaterThanOrEqual(2);
			expect(palette.colors.length).toBeLessThanOrEqual(16);
			for (const hex of palette.colors) {
				expect(hex).toMatch(HEX_RE);
			}
		}
	});
});

describe('toFloat3', () => {
	it('returns 16 vec3 (48 floats)', () => {
		expect(toFloat3('gameboy')).toHaveLength(48);
	});

	it('fills the real colors, sRGB 0..1, then pads with zeros', () => {
		const out = toFloat3('macintosh'); // #000000, #ffffff
		expect(Array.from(out.slice(0, 3))).toEqual([0, 0, 0]);
		expect(Array.from(out.slice(3, 6))).toEqual([1, 1, 1]);
		expect(Array.from(out.slice(6))).toEqual(new Array(42).fill(0));
	});

	it("is all zeros for 'aucune'", () => {
		expect(Array.from(toFloat3('aucune'))).toEqual(new Array(48).fill(0));
	});

	it('is all zeros for an unknown palette name', () => {
		expect(Array.from(toFloat3('does-not-exist'))).toEqual(new Array(48).fill(0));
	});
});

describe('nearest', () => {
	it('finds the closest color by euclidean RGB distance', () => {
		// gameboy: 0f380f, 306230, 8bac0f, 9bbc0f
		expect(nearest([250, 250, 250], 'gameboy')).toEqual([155, 188, 15]); // 9bbc0f, le plus clair
		expect(nearest([5, 5, 5], 'gameboy')).toEqual([15, 56, 15]); // 0f380f, le plus sombre
	});

	it('accepts a Palette object as well as a name', () => {
		const gameboy = byName('gameboy');
		if (!gameboy) throw new Error('fixture manquante');
		expect(nearest([5, 5, 5], gameboy)).toEqual(nearest([5, 5, 5], 'gameboy'));
	});

	it('is deterministic — same input, same output, across repeated calls', () => {
		const results = Array.from({ length: 20 }, () => nearest([120, 60, 200], 'acid_orange'));
		for (const r of results) expect(r).toEqual(results[0]);
	});

	it('breaks an exact tie by picking the earliest palette entry', () => {
		// Palette de test construite pour une égalité exacte : (50,50,50) est
		// à distance identique de (0,0,0) et (100,100,100). Le premier dans
		// l'ordre de la palette gagne.
		const tiedPalette = { name: 'aucune' as const, label: 'test', colors: ['#000000', '#646464'] };
		expect(nearest([50, 50, 50], tiedPalette)).toEqual([0, 0, 0]);

		const reversed = { name: 'aucune' as const, label: 'test', colors: ['#646464', '#000000'] };
		expect(nearest([50, 50, 50], reversed)).toEqual([100, 100, 100]);
	});

	it("returns the input unchanged for 'aucune' or an unknown palette", () => {
		expect(nearest([10, 20, 30], 'aucune')).toEqual([10, 20, 30]);
		expect(nearest([10, 20, 30], 'does-not-exist')).toEqual([10, 20, 30]);
	});
});
