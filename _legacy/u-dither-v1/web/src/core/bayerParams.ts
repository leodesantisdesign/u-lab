import { type PaletteName, sanitizePalette } from "./paletteParams";

export type BayerMatrix = "bayer2" | "bayer4" | "bayer8" | "cross" | "diamond" | "lines";

export type BayerParams = {
  matrix: BayerMatrix;
  scale: number;
  levels: number;
  contrast: number;
  invert: boolean;
  postBlur: number;
  colorMode: "mono" | "source" | "rgb";
  palette: PaletteName;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const BAYER_DEFAULTS: BayerParams = {
  matrix: "bayer8",
  scale: 4,
  levels: 2,
  contrast: 0,
  invert: false,
  postBlur: 0,
  colorMode: "mono",
  palette: "none",
};

const BAYER_MATRICES: BayerMatrix[] = ["bayer2", "bayer4", "bayer8", "cross", "diamond", "lines"];
const BAYER_COLOR_MODES: BayerParams["colorMode"][] = ["mono", "source", "rgb"];

export function sanitizeBayer(raw: Partial<BayerParams>): BayerParams {
  const matrix = BAYER_MATRICES.includes(raw.matrix as BayerMatrix) ? (raw.matrix as BayerMatrix) : BAYER_DEFAULTS.matrix;
  const colorMode = BAYER_COLOR_MODES.includes(raw.colorMode as BayerParams["colorMode"]) ? (raw.colorMode as BayerParams["colorMode"]) : BAYER_DEFAULTS.colorMode;

  return {
    matrix,
    scale: clamp(Math.round(raw.scale ?? BAYER_DEFAULTS.scale), 1, 16),
    levels: clamp(Math.round(raw.levels ?? BAYER_DEFAULTS.levels), 2, 8),
    contrast: clamp(Number(raw.contrast ?? BAYER_DEFAULTS.contrast), -50, 50),
    invert: Boolean(raw.invert ?? BAYER_DEFAULTS.invert),
    postBlur: clamp(Number(raw.postBlur ?? BAYER_DEFAULTS.postBlur), 0, 1),
    colorMode,
    palette: sanitizePalette(raw.palette),
  };
}

export function bayerToBackend(p: BayerParams) {
  return {
    mode: "bayer",
    bayer_matrix: p.matrix,
    bayer_scale: String(p.scale),
    bayer_levels: String(p.levels),
    bayer_contrast: String(p.contrast / 100),
    bayer_invert: String(Boolean(p.invert)),
    bayer_post_blur: String(p.postBlur),
    bayer_color_mode: p.colorMode,
    bayer_palette: p.palette,
  };
}
