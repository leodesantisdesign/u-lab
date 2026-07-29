export type PaletteName = 'aucune' | 'macintosh' | 'gameboy' | 'cga' | 'warm_print' | 'acid_orange';

export type Palette = {
	name: PaletteName;
	label: string;
	/** Hex `#rrggbb`, 0 à 16 couleurs. 0 uniquement pour 'aucune'. */
	colors: readonly string[];
};

// Six palettes signées, pas neuf, et pas d'éditeur personnalisé
// (docs/ETAPE-2.md §2 : « six palettes signées valent mieux qu'un
// générateur de moche »). Clés reprises de
// _legacy/u-dither-v1/web/src/core/paletteParams.ts pour la continuité.
// pico8, cold_signal, xerox_heat et 'custom' sont reportés.
export const PALETTES: readonly Palette[] = [
	{ name: 'aucune', label: 'Aucune', colors: [] },
	{ name: 'macintosh', label: 'Macintosh 1 bit', colors: ['#000000', '#ffffff'] },
	{
		name: 'gameboy',
		label: 'Game Boy',
		colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
	},
	{
		name: 'cga',
		label: 'CGA',
		colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
	},
	{
		name: 'warm_print',
		label: 'Impression chaude',
		colors: ['#15110f', '#6b3428', '#c06c3e', '#e7b65a', '#f6e6c8'],
	},
	{
		name: 'acid_orange',
		label: 'Acid',
		colors: [
			'#070000',
			'#220100',
			'#5b0300',
			'#c11200',
			'#ff2b00',
			'#ff6606',
			'#ffd000',
			'#fff6c9',
		],
	},
];
