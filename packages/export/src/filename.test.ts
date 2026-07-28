import { describe, expect, it } from 'vitest';
import { exportFilename } from './filename.ts';

const FIXED_DATE = new Date(2026, 6, 28, 9, 5); // 28 juillet 2026, 09:05 — mois 0-indexé

describe('exportFilename', () => {
	it('builds ulab-<kebab>-<AAAAMMJJ-HHMM>.<ext>', () => {
		expect(exportFilename('Mon super projet', 'png', FIXED_DATE)).toBe(
			'ulab-mon-super-projet-20260728-0905.png',
		);
	});

	it('strips accents', () => {
		expect(exportFilename('Éditée à la volée', 'jpg', FIXED_DATE)).toBe(
			'ulab-editee-a-la-volee-20260728-0905.jpg',
		);
	});

	it('collapses punctuation and repeated separators into single dashes', () => {
		expect(exportFilename('  Projet ##1 -- final!!  ', 'png', FIXED_DATE)).toBe(
			'ulab-projet-1-final-20260728-0905.png',
		);
	});

	it('falls back to "sans-titre" when the name has no kebab-able characters', () => {
		expect(exportFilename('***', 'png', FIXED_DATE)).toBe('ulab-sans-titre-20260728-0905.png');
	});

	it('pads single-digit month, day, hour and minute', () => {
		const date = new Date(2026, 0, 3, 4, 7); // 3 janvier 2026, 04:07
		expect(exportFilename('x', 'png', date)).toBe('ulab-x-20260103-0407.png');
	});
});
