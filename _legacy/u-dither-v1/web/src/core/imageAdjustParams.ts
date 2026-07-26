export type ImageAdjustParams = {
  brightness: number;
  contrast: number;
  gamma: number;
  saturation: number;
  invert: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const IMAGE_ADJUST_DEFAULTS: ImageAdjustParams = {
  brightness: 0,
  contrast: 0,
  gamma: 1,
  saturation: 0,
  invert: false,
};

export function sanitizeImageAdjust(raw: Partial<ImageAdjustParams>): ImageAdjustParams {
  return {
    brightness: clamp(Number(raw.brightness ?? IMAGE_ADJUST_DEFAULTS.brightness), -50, 50),
    contrast: clamp(Number(raw.contrast ?? IMAGE_ADJUST_DEFAULTS.contrast), -50, 50),
    gamma: clamp(Number(raw.gamma ?? IMAGE_ADJUST_DEFAULTS.gamma), 0.4, 3),
    saturation: clamp(Number(raw.saturation ?? IMAGE_ADJUST_DEFAULTS.saturation), -100, 100),
    invert: Boolean(raw.invert ?? IMAGE_ADJUST_DEFAULTS.invert),
  };
}

export function imageAdjustToBackend(p: ImageAdjustParams) {
  return {
    image_brightness: String(p.brightness / 100),
    image_contrast: String(p.contrast / 100),
    image_gamma: String(p.gamma),
    image_saturation: String(p.saturation / 100),
    image_invert: String(Boolean(p.invert)),
  };
}
