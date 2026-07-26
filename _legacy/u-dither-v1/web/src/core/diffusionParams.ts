import { type PaletteName, sanitizePalette } from "./paletteParams";

export type DiffusionAlgorithm = "floyd_steinberg" | "atkinson";

export type DiffusionParams = {
  algorithm: DiffusionAlgorithm;
  levels: number;
  contrast: number;
  brightness: number;
  gamma: number;
  serpentine: boolean;
  invert: boolean;
  colorMode: "mono" | "source" | "rgb";
  palette: PaletteName;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const FLOYD_DEFAULTS: DiffusionParams = {
  algorithm: "floyd_steinberg",
  levels: 2,
  contrast: 12,
  brightness: 0,
  gamma: 1.0,
  serpentine: true,
  invert: false,
  colorMode: "mono",
  palette: "none",
};

export const ATKINSON_DEFAULTS: DiffusionParams = {
  algorithm: "atkinson",
  levels: 2,
  contrast: 18,
  brightness: 0,
  gamma: 1.0,
  serpentine: true,
  invert: false,
  colorMode: "mono",
  palette: "none",
};

export function sanitizeDiffusion(raw: Partial<DiffusionParams>, algorithm: DiffusionAlgorithm): DiffusionParams {
  const defaults = algorithm === "atkinson" ? ATKINSON_DEFAULTS : FLOYD_DEFAULTS;
  const colorModes: DiffusionParams["colorMode"][] = ["mono", "source", "rgb"];
  const colorMode = colorModes.includes(raw.colorMode as any) ? (raw.colorMode as DiffusionParams["colorMode"]) : defaults.colorMode;
  return {
    algorithm,
    levels: clamp(Math.round(raw.levels ?? defaults.levels), 2, 8),
    contrast: clamp(Number(raw.contrast ?? defaults.contrast), -50, 50),
    brightness: clamp(Number(raw.brightness ?? defaults.brightness), -50, 50),
    gamma: clamp(Number(raw.gamma ?? defaults.gamma), 0.4, 3.0),
    serpentine: Boolean(raw.serpentine ?? defaults.serpentine),
    invert: Boolean(raw.invert ?? defaults.invert),
    colorMode,
    palette: sanitizePalette(raw.palette),
  };
}

export function diffusionToBackend(p: DiffusionParams) {
  return {
    mode: p.algorithm,
    diffusion_algorithm: p.algorithm,
    diffusion_levels: String(p.levels),
    diffusion_contrast: String(p.contrast / 100),
    diffusion_brightness: String(p.brightness / 100),
    diffusion_gamma: String(p.gamma),
    diffusion_serpentine: String(Boolean(p.serpentine)),
    diffusion_invert: String(Boolean(p.invert)),
    diffusion_color_mode: p.colorMode,
    diffusion_palette: p.palette,
  };
}
