import { byName, nearest } from '@ulab/palette';

// Forme de @ulab/core#ParamValue, recopiée plutôt qu'importée : packages/modules
// n'a le droit de dépendre que de @ulab/palette (architecture §6), même en
// type-only — contrairement à packages/engine, qui a une entorse documentée
// pour @ulab/modules (ETAPE-2.md §3.5). Le contrat worker (§3.3) écrit
// `Record<string, ParamValue>` : cette forme locale EST ce type, pas une
// approximation.
type ParamValue = number | string | boolean | { x: number; y: number } | { x: number; y: number }[] | null;

type Kernel = ReadonlyArray<readonly [dx: number, dy: number, weight: number]>;

// Floyd & Steinberg, 1976 — la référence depuis cinquante ans.
const FLOYD_STEINBERG: Kernel = [
	[1, 0, 7 / 16],
	[-1, 1, 3 / 16],
	[0, 1, 5 / 16],
	[1, 1, 1 / 16],
];

// Atkinson, Macintosh ~1984 : seuls 3/4 de l'erreur sont propagés (6 × 1/8 =
// 3/4, pas 1) — d'où des blancs qui claquent et un contraste plus dur que
// Floyd–Steinberg (docs/U.LAB-TRAMAGE.md §2.2).
const ATKINSON: Kernel = [
	[1, 0, 1 / 8],
	[2, 0, 1 / 8],
	[-1, 1, 1 / 8],
	[0, 1, 1 / 8],
	[1, 1, 1 / 8],
	[0, 2, 1 / 8],
];

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Diffusion d'erreur générique sur N canaux indépendants (1 = niveaux de
 * gris, 3 = RGB vers palette) — même balayage, même noyau, seule la
 * fonction de quantification par pixel change.
 *
 * Balayage SERPENTIN câblé en dur (jamais un paramètre) : il est simplement
 * meilleur, ce n'est pas un arbitrage à faire porter à l'utilisateur.
 */
function diffuse(
	channels: Float32Array[],
	width: number,
	height: number,
	kernel: Kernel,
	quantize: (values: number[]) => number[],
): Uint8ClampedArray[] {
	const outputs = channels.map(() => new Uint8ClampedArray(width * height));

	for (let y = 0; y < height; y++) {
		const reverse = y % 2 === 1;
		for (let step = 0; step < width; step++) {
			const x = reverse ? width - 1 - step : step;
			const idx = y * width + x;

			const oldValues = channels.map((channel) => channel[idx] ?? 0);
			const newValues = quantize(oldValues);

			for (let c = 0; c < channels.length; c++) {
				const channel = channels[c];
				const output = outputs[c];
				const newValue = newValues[c] ?? 0;
				if (!channel || !output) continue;
				output[idx] = newValue;
				const error = (oldValues[c] ?? 0) - newValue;

				for (const [dx, dy, weight] of kernel) {
					const tx = reverse ? x - dx : x + dx;
					const ty = y + dy;
					if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
					const targetIdx = ty * width + tx;
					channel[targetIdx] = (channel[targetIdx] ?? 0) + error * weight;
				}
			}
		}
	}

	return outputs;
}

/**
 * Diffusion d'erreur (Floyd–Steinberg / Atkinson). Contrat ETAPE-2.md §3.3.
 *
 * Point non négociable (docs/U.LAB-TRAMAGE.md §5) : quand une palette est
 * choisie, la quantification se fait DIRECTEMENT sur ses couleurs et
 * l'erreur diffusée est calculée par rapport à la couleur de palette
 * retenue — jamais en gris avec un mapping après coup, qui produirait des
 * bandes et annulerait l'algorithme.
 */
export default function process(
	input: ImageData,
	params: Record<string, ParamValue>,
	_ctx: { seed: number; time: number; scale: number },
): ImageData {
	const { width, height, data } = input;
	const size = width * height;

	const kernel = params.algorithm === 'atkinson' ? ATKINSON : FLOYD_STEINBERG;
	const levels = clamp(Math.round(Number(params.levels ?? 2)), 2, 8);
	const invert = params.invert === true;
	const paletteName = typeof params.palette === 'string' ? params.palette : 'aucune';
	const palette = paletteName !== 'aucune' ? byName(paletteName) : undefined;

	const output = new Uint8ClampedArray(data.length);

	if (palette && palette.colors.length > 0) {
		const r = new Float32Array(size);
		const g = new Float32Array(size);
		const b = new Float32Array(size);
		for (let i = 0; i < size; i++) {
			const base = i * 4;
			let rv = data[base] ?? 0;
			let gv = data[base + 1] ?? 0;
			let bv = data[base + 2] ?? 0;
			if (invert) {
				rv = 255 - rv;
				gv = 255 - gv;
				bv = 255 - bv;
			}
			r[i] = rv;
			g[i] = gv;
			b[i] = bv;
		}

		const [outR, outG, outB] = diffuse([r, g, b], width, height, kernel, (values) => {
			const [rr, gg, bb] = nearest(
				[
					clamp(Math.round(values[0] ?? 0), 0, 255),
					clamp(Math.round(values[1] ?? 0), 0, 255),
					clamp(Math.round(values[2] ?? 0), 0, 255),
				],
				palette,
			);
			return [rr, gg, bb];
		});

		for (let i = 0; i < size; i++) {
			const base = i * 4;
			output[base] = outR?.[i] ?? 0;
			output[base + 1] = outG?.[i] ?? 0;
			output[base + 2] = outB?.[i] ?? 0;
			output[base + 3] = data[base + 3] ?? 255;
		}
	} else {
		const gray = new Float32Array(size);
		for (let i = 0; i < size; i++) {
			const base = i * 4;
			let luma = 0.2126 * (data[base] ?? 0) + 0.7152 * (data[base + 1] ?? 0) + 0.0722 * (data[base + 2] ?? 0);
			if (invert) luma = 255 - luma;
			gray[i] = luma;
		}

		const [outGray] = diffuse([gray], width, height, kernel, (values) => {
			const step = clamp(Math.round(((values[0] ?? 0) / 255) * (levels - 1)), 0, levels - 1);
			return [(step / (levels - 1)) * 255];
		});

		for (let i = 0; i < size; i++) {
			const base = i * 4;
			const value = outGray?.[i] ?? 0;
			output[base] = value;
			output[base + 1] = value;
			output[base + 2] = value;
			output[base + 3] = data[base + 3] ?? 255;
		}
	}

	return new ImageData(output, width, height);
}
