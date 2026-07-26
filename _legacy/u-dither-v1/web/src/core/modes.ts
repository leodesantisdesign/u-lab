import { HALFTONE_DEFAULTS, halftoneToBackend, sanitizeHalftone } from "./halftoneParams";
import { BAYER_DEFAULTS, type BayerParams, bayerToBackend, sanitizeBayer } from "./bayerParams";
import {
  ATKINSON_DEFAULTS,
  FLOYD_DEFAULTS,
  type DiffusionParams,
  diffusionToBackend,
  sanitizeDiffusion,
} from "./diffusionParams";
import type { HalftoneParams } from "./halftoneParams";

export type Mode = "halftone" | "bayer" | "floyd_steinberg" | "atkinson";

export type ParamsByMode = {
  halftone: HalftoneParams;
  bayer: BayerParams;
  floyd_steinberg: DiffusionParams;
  atkinson: DiffusionParams;
};

export const DEFAULT_PARAMS: ParamsByMode = {
  halftone: HALFTONE_DEFAULTS,
  bayer: BAYER_DEFAULTS,
  floyd_steinberg: FLOYD_DEFAULTS,
  atkinson: ATKINSON_DEFAULTS,
};

export function sanitizeForMode<M extends Mode>(mode: M, params: Partial<ParamsByMode[M]>): ParamsByMode[M] {
  if (mode === "halftone") return sanitizeHalftone(params as Partial<HalftoneParams>) as ParamsByMode[M];
  if (mode === "bayer") return sanitizeBayer(params as Partial<BayerParams>) as ParamsByMode[M];
  if (mode === "floyd_steinberg") return sanitizeDiffusion(params as Partial<DiffusionParams>, "floyd_steinberg") as ParamsByMode[M];
  return sanitizeDiffusion(params as Partial<DiffusionParams>, "atkinson") as ParamsByMode[M];
}

export function toBackendPayload(mode: Mode, params: ParamsByMode[Mode], maxSide: number) {
  const base = { max_side: String(maxSide), mode } as Record<string, string>;
  if (mode === "halftone") return { ...base, ...halftoneToBackend(params as HalftoneParams) };
  if (mode === "bayer") return { ...base, ...bayerToBackend(params as BayerParams) };
  return { ...base, ...diffusionToBackend(params as DiffusionParams) };
}
