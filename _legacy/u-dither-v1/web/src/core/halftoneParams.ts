import { type PaletteName, sanitizePalette } from "./paletteParams";

export type HalftoneParams = {
  cellSize: number;
  dotSize: number;
  minDot: number;
  gamma: number;
  contrast: number;
  shape: "circle" | "square" | "roundedSquare";
  roundness: number;
  jitter: number;
  stretch: number;
  invert: boolean;
  colorMode: "mono" | "source";
  palette: PaletteName;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const HALFTONE_DEFAULTS: HalftoneParams = {
  cellSize: 18,
  dotSize: 96,
  minDot: 8,
  gamma: 1.3,
  contrast: 0,
  shape: "circle",
  roundness: 60,
  jitter: 6,
  stretch: 100,
  invert: false,
  colorMode: "mono",
  palette: "none",
};

const HALFTONE_SHAPES: HalftoneParams["shape"][] = ["circle", "square", "roundedSquare"];
const HALFTONE_COLOR_MODES: HalftoneParams["colorMode"][] = ["mono", "source"];

export function sanitizeHalftone(raw: Partial<HalftoneParams>): HalftoneParams {
  const shape = HALFTONE_SHAPES.includes(raw.shape as HalftoneParams["shape"]) ? (raw.shape as HalftoneParams["shape"]) : HALFTONE_DEFAULTS.shape;
  const colorMode = HALFTONE_COLOR_MODES.includes(raw.colorMode as HalftoneParams["colorMode"]) ? (raw.colorMode as HalftoneParams["colorMode"]) : HALFTONE_DEFAULTS.colorMode;

  return {
    cellSize: clamp(Math.round(raw.cellSize ?? HALFTONE_DEFAULTS.cellSize), 4, 80),
    dotSize: clamp(raw.dotSize ?? HALFTONE_DEFAULTS.dotSize, 20, 130),
    minDot: clamp(raw.minDot ?? HALFTONE_DEFAULTS.minDot, 0, 100),
    gamma: clamp(Number(raw.gamma ?? HALFTONE_DEFAULTS.gamma), 0.4, 3.0),
    contrast: clamp(Number(raw.contrast ?? HALFTONE_DEFAULTS.contrast), -50, 50),
    shape,
    roundness: clamp(Number(raw.roundness ?? HALFTONE_DEFAULTS.roundness), 0, 100),
    jitter: clamp(Number(raw.jitter ?? HALFTONE_DEFAULTS.jitter), 0, 100),
    stretch: clamp(Number(raw.stretch ?? HALFTONE_DEFAULTS.stretch), 60, 160),
    invert: Boolean(raw.invert ?? HALFTONE_DEFAULTS.invert),
    colorMode,
    palette: sanitizePalette(raw.palette),
  };
}

export function halftoneToBackend(p: HalftoneParams) {
  const cell = p.cellSize;
  const halfCell = cell * 0.5;
  const supersample = cell <= 10 ? 4 : 2;

  return {
    cell_size: String(cell),
    gamma: String(p.gamma),
    contrast: String(p.contrast / 100),
    min_dot: String(halfCell * (p.minDot / 100)),
    max_radius: String(halfCell * (p.dotSize / 100)),
    shape: p.shape,
    roundness: String(p.roundness / 100),
    jitter: String(p.jitter / 100),
    stretch: String(p.stretch / 100),
    invert: String(Boolean(p.invert)),
    halftone_color_mode: p.colorMode,
    halftone_palette: p.palette,
    supersample: String(supersample),
  };
}
