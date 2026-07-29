import { PALETTES } from './palettes.ts';
import type { Palette } from './palettes.ts';

export type { Palette, PaletteName } from './palettes.ts';

/** RGB 0..255, l'espace de `ImageData` — pour le chemin Worker (dither, vague B). */
export type RGB255 = readonly [number, number, number];

function hexToRgb255(hex: string): RGB255 {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	const value = match?.[1];
	if (!value) return [0, 0, 0];
	const int = Number.parseInt(value, 16);
	return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

export function all(): readonly Palette[] {
	return PALETTES;
}

export function byName(name: string): Palette | undefined {
	return PALETTES.find((palette) => palette.name === name);
}

/**
 * 16 × vec3 sRGB 0..1, complétée de zéros au-delà du nombre réel de
 * couleurs — c'est exactement la forme attendue par l'uniforme
 * `u_<key>[16]` (ETAPE-2.md §3.1/§3.4). `u_<key>_count` (fourni à côté par
 * le moteur) dit au shader où s'arrêter ; le padding n'est jamais lu au-delà.
 */
export function toFloat3(name: string): Float32Array {
	const out = new Float32Array(16 * 3);
	const palette = byName(name);
	if (!palette) return out;

	for (let i = 0; i < palette.colors.length && i < 16; i++) {
		const hex = palette.colors[i];
		if (!hex) continue;
		const [r, g, b] = hexToRgb255(hex);
		out[i * 3] = r / 255;
		out[i * 3 + 1] = g / 255;
		out[i * 3 + 2] = b / 255;
	}
	return out;
}

/**
 * La couleur de `palette` la plus proche de `color`, en distance euclidienne
 * RGB — pour le chemin Worker (l'error diffusion doit quantifier vers la
 * palette cible, docs/U.LAB-TRAMAGE.md §5). 0..255 comme `ImageData`, pas
 * 0..1 : évite une conversion par pixel dans une boucle déjà coûteuse.
 * Stable et déterministe : balayage linéaire dans l'ordre de la palette,
 * la meilleure trouvée EN PREMIER l'emporte sur une égalité exacte.
 * Palette introuvable ou vide (dont 'aucune') ⇒ `color` inchangée.
 */
export function nearest(color: RGB255, palette: Palette | string): RGB255 {
	const p = typeof palette === 'string' ? byName(palette) : palette;
	const firstHex = p?.colors[0];
	if (!p || !firstHex) return color;

	let best: RGB255 = hexToRgb255(firstHex);
	let bestDist = distanceSq(color, best);

	for (let i = 1; i < p.colors.length; i++) {
		const hex = p.colors[i];
		if (!hex) continue;
		const candidate = hexToRgb255(hex);
		const dist = distanceSq(color, candidate);
		if (dist < bestDist) {
			bestDist = dist;
			best = candidate;
		}
	}

	return best;
}

function distanceSq(a: RGB255, b: RGB255): number {
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return dr * dr + dg * dg + db * db;
}
