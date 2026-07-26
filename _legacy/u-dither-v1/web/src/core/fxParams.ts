export type EffectId = "acidGlow" | "noise" | "scanlines" | "sharpen" | "grain" | "vignette" | "posterize" | "chromaticShift" | "ascii";

export type EffectStackItem = {
  id: EffectId;
  enabled: boolean;
  amount: number;
};

export type FxParams = {
  noise: number;
  scanlines: number;
  chromaticShift: number;
  ascii: number;
  vignette: number;
  posterize: number;
  acidGlow: number;
  sharpen: number;
  grain: number;
  seed: number;
  stack: EffectStackItem[];
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const EFFECT_META: Record<EffectId, { label: string; min: number; max: number; step: number; defaultAmount: number; tip: string }> = {
  acidGlow: {
    label: "Acid Glow",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 72,
    tip: "Adds hot orange bloom around bright pixels.",
  },
  noise: {
    label: "Noise",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 18,
    tip: "Adds fine deterministic noise after the look.",
  },
  scanlines: {
    label: "Scanlines",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 18,
    tip: "Darkens alternating rows for CRT and print texture.",
  },
  sharpen: {
    label: "Sharpen",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 28,
    tip: "Boosts edge contrast after dithering.",
  },
  grain: {
    label: "Grain",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 16,
    tip: "Adds rough monochrome film grain.",
  },
  vignette: {
    label: "Vignette",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 28,
    tip: "Darkens edges and centers the composition.",
  },
  posterize: {
    label: "Posterize",
    min: 0,
    max: 16,
    step: 1,
    defaultAmount: 6,
    tip: "Reduces tonal precision for poster-like bands.",
  },
  chromaticShift: {
    label: "Chromatic Shift",
    min: -24,
    max: 24,
    step: 1,
    defaultAmount: 0,
    tip: "Offsets red and blue channels in opposite directions.",
  },
  ascii: {
    label: "ASCII",
    min: 0,
    max: 100,
    step: 1,
    defaultAmount: 58,
    tip: "Turns tonal blocks into glyph-like pixel marks.",
  },
};

export const DEFAULT_EFFECT_ORDER: EffectId[] = ["acidGlow", "noise", "scanlines", "sharpen", "grain", "vignette"];

export function createEffectStack(values: Partial<Record<EffectId, number>> = {}, enabled: Partial<Record<EffectId, boolean>> = {}, order = DEFAULT_EFFECT_ORDER): EffectStackItem[] {
  return order.map((id) => ({
    id,
    enabled: enabled[id] ?? (values[id] ?? 0) !== 0,
    amount: values[id] ?? EFFECT_META[id].defaultAmount,
  }));
}

export const FX_DEFAULTS: FxParams = {
  noise: 0,
  scanlines: 0,
  chromaticShift: 0,
  ascii: 0,
  vignette: 0,
  posterize: 0,
  acidGlow: 0,
  sharpen: 0,
  grain: 0,
  seed: 0,
  stack: createEffectStack({}, {}, ["acidGlow", "noise", "scanlines", "sharpen", "grain"]),
};

export function sanitizeFx(raw: Partial<FxParams>): FxParams {
  const fallbackValues: Partial<Record<EffectId, number>> = {
    acidGlow: Number(raw.acidGlow ?? FX_DEFAULTS.acidGlow),
    noise: Number(raw.noise ?? FX_DEFAULTS.noise),
    scanlines: Number(raw.scanlines ?? FX_DEFAULTS.scanlines),
    sharpen: Number(raw.sharpen ?? FX_DEFAULTS.sharpen),
    grain: Number(raw.grain ?? FX_DEFAULTS.grain),
    vignette: Number(raw.vignette ?? FX_DEFAULTS.vignette),
    posterize: Number(raw.posterize ?? FX_DEFAULTS.posterize),
    chromaticShift: Number(raw.chromaticShift ?? FX_DEFAULTS.chromaticShift),
    ascii: Number(raw.ascii ?? FX_DEFAULTS.ascii),
  };
  const stack = Array.isArray(raw.stack) && raw.stack.length
    ? raw.stack
        .filter((item): item is EffectStackItem => Boolean(item && EFFECT_META[item.id as EffectId]))
        .map((item) => {
          const meta = EFFECT_META[item.id];
          return {
            id: item.id,
            enabled: Boolean(item.enabled),
            amount: clamp(Number(item.amount ?? meta.defaultAmount), meta.min, meta.max),
          };
        })
    : createEffectStack(fallbackValues, {}, ["acidGlow", "noise", "scanlines", "vignette", "posterize", "chromaticShift", "ascii"]);

  const aggregate = stack.reduce<Partial<Record<EffectId, number>>>((acc, item) => {
    acc[item.id] = item.enabled ? item.amount : 0;
    return acc;
  }, {});

  return {
    noise: clamp(Number(aggregate.noise ?? fallbackValues.noise ?? 0), 0, 100),
    scanlines: clamp(Number(aggregate.scanlines ?? fallbackValues.scanlines ?? 0), 0, 100),
    chromaticShift: clamp(Math.round(aggregate.chromaticShift ?? fallbackValues.chromaticShift ?? 0), -24, 24),
    ascii: clamp(Number(aggregate.ascii ?? fallbackValues.ascii ?? 0), 0, 100),
    vignette: clamp(Number(aggregate.vignette ?? fallbackValues.vignette ?? 0), 0, 100),
    posterize: clamp(Math.round(aggregate.posterize ?? fallbackValues.posterize ?? 0), 0, 16),
    acidGlow: clamp(Number(aggregate.acidGlow ?? fallbackValues.acidGlow ?? 0), 0, 100),
    sharpen: clamp(Number(aggregate.sharpen ?? fallbackValues.sharpen ?? 0), 0, 100),
    grain: clamp(Number(aggregate.grain ?? fallbackValues.grain ?? 0), 0, 100),
    seed: Math.round(raw.seed ?? FX_DEFAULTS.seed),
    stack,
  };
}

export function fxToBackend(p: FxParams) {
  return {
    fx_noise: String(p.noise / 100),
    fx_scanlines: String(p.scanlines / 100),
    fx_chromatic_shift: String(p.chromaticShift),
    fx_ascii: String(p.ascii / 100),
    fx_vignette: String(p.vignette / 100),
    fx_posterize: String(p.posterize),
    fx_acid_glow: String(p.acidGlow / 100),
    fx_sharpen: String(p.sharpen / 100),
    fx_grain: String(p.grain / 100),
    fx_seed: String(p.seed),
    fx_stack: JSON.stringify(p.stack),
  };
}
