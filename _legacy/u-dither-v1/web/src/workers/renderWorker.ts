type RenderMode = "halftone" | "bayer" | "floyd_steinberg" | "atkinson";

type WorkerRequest =
  | {
      id: number;
      type: "render";
      mode: RenderMode;
      width: number;
      height: number;
      data: Uint8ClampedArray;
      params: any;
      fx: any;
      imageAdjust?: any;
      customPalette: string[];
    }
  | {
      id: number;
      type: "palette";
      width: number;
      height: number;
      data: Uint8ClampedArray;
      colorCount: number;
    };

const PALETTES: Record<string, string[]> = {
  none: [],
  gameboy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  cga: ["#000000", "#55ffff", "#ff55ff", "#ffffff"],
  macintosh: ["#000000", "#ffffff"],
  pico8: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ff004d", "#ffa300", "#ffec27", "#29adff"],
  warm_print: ["#15110f", "#6b3428", "#c06c3e", "#e7b65a", "#f6e6c8"],
  cold_signal: ["#061820", "#123a4a", "#1d6f82", "#5bd7c7", "#f2fff8"],
  xerox_heat: ["#050201", "#250401", "#7a0900", "#d81f00", "#ff6606", "#ffd15a", "#f4eee1"],
  acid_orange: ["#070000", "#220100", "#5b0300", "#c11200", "#ff2b00", "#ff6606", "#ffd000", "#fff6c9"],
};

const BAYER2 = [
  [0, 2],
  [3, 1],
].map((row) => row.map((v) => v / 4));
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16));
const BAYER8 = makeBayer8();
const MATRICES: Record<string, number[][]> = {
  bayer2: BAYER2,
  bayer4: BAYER4,
  bayer8: BAYER8,
  cross: [
    [0.9, 0.6, 0.7, 0.6, 0.9],
    [0.6, 0.3, 0.2, 0.3, 0.6],
    [0.7, 0.2, 0, 0.2, 0.7],
    [0.6, 0.3, 0.2, 0.3, 0.6],
    [0.9, 0.6, 0.7, 0.6, 0.9],
  ],
  diamond: [
    [0.8, 0.6, 0.4, 0.6, 0.8],
    [0.6, 0.2, 0.1, 0.2, 0.6],
    [0.4, 0.1, 0, 0.1, 0.4],
    [0.6, 0.2, 0.1, 0.2, 0.6],
    [0.8, 0.6, 0.4, 0.6, 0.8],
  ],
  lines: [
    [0.1, 0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.3],
    [0.2, 0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4],
  ],
};

(self as any).onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "palette") {
    const colors = extractPalette(msg.data, msg.width, msg.height, msg.colorCount);
    (self as any).postMessage({ id: msg.id, type: "palette", colors });
    return;
  }

  const out = render(msg.data, msg.width, msg.height, msg.mode, msg.params, msg.fx, msg.customPalette, msg.imageAdjust);
  (self as any).postMessage({ id: msg.id, type: "render", width: msg.width, height: msg.height, data: out }, [out.buffer]);
};

function makeBayer8() {
  const out = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
  const t = [
    [0, 2],
    [3, 1],
  ];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      for (let yy = 0; yy < 2; yy++) {
        for (let xx = 0; xx < 2; xx++) out[y * 2 + yy][x * 2 + xx] = (4 * (BAYER4[y][x] * 16) + t[yy][xx]) / 64;
      }
    }
  }
  return out;
}

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function lum(data: Uint8ClampedArray, i: number) {
  return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
}

function adjust(v: number, contrast: number, invert: boolean) {
  let out = (v - 0.5) * (1 + contrast / 100) + 0.5;
  out = clamp(out, 0, 1);
  return invert ? 1 - out : out;
}

function render(data: Uint8ClampedArray, width: number, height: number, mode: RenderMode, params: any, fx: any, customPalette: string[], imageAdjust?: any) {
  let out: Uint8ClampedArray;
  const source = applyImageAdjust(data, imageAdjust);
  if (mode === "halftone") out = quantize(halftone(source, width, height, params), params.palette || "none", customPalette);
  else if (mode === "bayer") out = bayer(source, width, height, params, customPalette);
  else out = diffusion(source, width, height, { ...params, algorithm: mode }, customPalette);
  return postFx(out, width, height, fx);
}

function applyImageAdjust(data: Uint8ClampedArray, p: any) {
  const brightness = Number(p?.brightness ?? 0) / 100;
  const contrast = Number(p?.contrast ?? 0) / 100;
  const gamma = Math.max(0.4, Math.min(3, Number(p?.gamma ?? 1)));
  const saturation = Number(p?.saturation ?? 0) / 100;
  const invert = Boolean(p?.invert);
  if (brightness === 0 && contrast === 0 && gamma === 1 && saturation === 0 && !invert) return data;
  const out = new Uint8ClampedArray(data);
  const contrastFactor = 1 + contrast;
  const saturationFactor = 1 + saturation;
  for (let i = 0; i < out.length; i += 4) {
    let r = Math.pow(clamp(data[i] / 255 + brightness, 0, 1), 1 / gamma);
    let g = Math.pow(clamp(data[i + 1] / 255 + brightness, 0, 1), 1 / gamma);
    let b = Math.pow(clamp(data[i + 2] / 255 + brightness, 0, 1), 1 / gamma);
    r = clamp((r - 0.5) * contrastFactor + 0.5, 0, 1);
    g = clamp((g - 0.5) * contrastFactor + 0.5, 0, 1);
    b = clamp((b - 0.5) * contrastFactor + 0.5, 0, 1);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = clamp(l + (r - l) * saturationFactor, 0, 1);
    g = clamp(l + (g - l) * saturationFactor, 0, 1);
    b = clamp(l + (b - l) * saturationFactor, 0, 1);
    if (invert) {
      r = 1 - r;
      g = 1 - g;
      b = 1 - b;
    }
    out[i] = Math.round(r * 255);
    out[i + 1] = Math.round(g * 255);
    out[i + 2] = Math.round(b * 255);
  }
  return out;
}

function bayer(data: Uint8ClampedArray, width: number, height: number, p: any, customPalette: string[]) {
  const out = new Uint8ClampedArray(width * height * 4);
  const matrix = MATRICES[p.matrix] || BAYER8;
  const levels = Math.max(2, Math.round(p.levels || 2));
  const scale = Math.max(1, Math.round(p.scale || 1));
  const colorMode = p.colorMode || "mono";
  for (let y = 0; y < height; y++) {
    const ty = Math.floor(y / scale) % matrix.length;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const tx = Math.floor(x / scale) % matrix[0].length;
      const t = matrix[ty][tx];
      if (colorMode === "rgb") {
        for (let c = 0; c < 3; c++) {
          const v = adjust(data[i + c] / 255, p.contrast || 0, Boolean(p.invert));
          out[i + c] = Math.round((Math.max(0, Math.min(levels - 1, Math.floor(v * (levels - 1) + t))) / (levels - 1)) * 255);
        }
      } else {
        const d = Math.round((Math.max(0, Math.min(levels - 1, Math.floor(adjust(lum(data, i), p.contrast || 0, Boolean(p.invert)) * (levels - 1) + t))) / (levels - 1)) * 255);
        if (colorMode === "source") {
          out[i] = (data[i] * d) / 255;
          out[i + 1] = (data[i + 1] * d) / 255;
          out[i + 2] = (data[i + 2] * d) / 255;
        } else {
          out[i] = d;
          out[i + 1] = d;
          out[i + 2] = d;
        }
      }
      out[i + 3] = 255;
    }
  }
  let finalOut = quantize(out, p.palette || "none", customPalette);
  if ((p.postBlur || 0) > 0) finalOut = boxBlur(finalOut, width, height, Math.max(1, Math.round(2 * p.postBlur)));
  return finalOut;
}

function diffusion(data: Uint8ClampedArray, width: number, height: number, p: any, customPalette: string[]) {
  const colorMode = p.colorMode || "mono";
  const out = new Uint8ClampedArray(width * height * 4);
  if (colorMode === "rgb") {
    for (let c = 0; c < 3; c++) diffuseChannel(data, out, width, height, p, c);
  } else {
    const channel = diffuseLuma(data, width, height, p);
    for (let i = 0, px = 0; i < out.length; i += 4, px++) {
      const d = channel[px] * 255;
      if (colorMode === "source") {
        out[i] = (data[i] * d) / 255;
        out[i + 1] = (data[i + 1] * d) / 255;
        out[i + 2] = (data[i + 2] * d) / 255;
      } else {
        out[i] = d;
        out[i + 1] = d;
        out[i + 2] = d;
      }
      out[i + 3] = 255;
    }
  }
  return quantize(out, p.palette || "none", customPalette);
}

function cleanValue(v: number, p: any) {
  let out = Math.pow(clamp(v, 0, 1), 1 / Math.max(0.2, Number(p.gamma || 1)));
  out += (p.brightness || 0) / 100;
  out = (out - 0.5) * (1 + (p.contrast || 0) / 100) + 0.5;
  out = clamp(out, 0, 1);
  return p.invert ? 1 - out : out;
}

function diffuseLuma(data: Uint8ClampedArray, width: number, height: number, p: any) {
  const work = new Float32Array(width * height);
  for (let px = 0, i = 0; px < work.length; px++, i += 4) work[px] = cleanValue(lum(data, i), p);
  diffuseWork(work, width, height, p);
  return work;
}

function diffuseChannel(data: Uint8ClampedArray, out: Uint8ClampedArray, width: number, height: number, p: any, channel: number) {
  const work = new Float32Array(width * height);
  for (let px = 0, i = channel; px < work.length; px++, i += 4) work[px] = cleanValue(data[i] / 255, p);
  diffuseWork(work, width, height, p);
  for (let px = 0, i = channel; px < work.length; px++, i += 4) {
    out[i] = work[px] * 255;
    if (channel === 2) out[i + 1] = 255;
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
}

function diffuseWork(work: Float32Array, width: number, height: number, p: any) {
  const levels = Math.max(2, Math.round(p.levels || 2));
  const atkinson = p.algorithm === "atkinson";
  for (let y = 0; y < height; y++) {
    const reverse = Boolean(p.serpentine) && y % 2 === 1;
    const start = reverse ? width - 1 : 0;
    const end = reverse ? -1 : width;
    const step = reverse ? -1 : 1;
    for (let x = start; x !== end; x += step) {
      const idx = y * width + x;
      const old = work[idx];
      const next = Math.round(old * (levels - 1)) / (levels - 1);
      const err = old - next;
      work[idx] = clamp(next, 0, 1);
      const send = (dx: number, dy: number, weight: number) => {
        const tx = reverse ? x - dx : x + dx;
        const ty = y + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) work[ty * width + tx] += err * weight;
      };
      if (atkinson) {
        const w = 1 / 8;
        send(1, 0, w);
        send(2, 0, w);
        send(-1, 1, w);
        send(0, 1, w);
        send(1, 1, w);
        send(0, 2, w);
      } else {
        send(1, 0, 7 / 16);
        send(-1, 1, 3 / 16);
        send(0, 1, 5 / 16);
        send(1, 1, 1 / 16);
      }
    }
  }
}

function halftone(data: Uint8ClampedArray, width: number, height: number, p: any) {
  const out = new Uint8ClampedArray(width * height * 4);
  out.fill(255);
  const cell = Math.max(4, Math.round(p.cellSize || 18));
  const maxRadius = cell * 0.5 * ((p.dotSize || 96) / 100);
  const minRadius = cell * 0.5 * ((p.minDot || 0) / 100);
  const stretch = (p.stretch || 100) / 100;
  const roundness = (p.roundness || 0) / 100;
  const jitter = (p.jitter || 0) / 100;
  const rng = seeded(0);
  for (let y0 = 0; y0 < height; y0 += cell) {
    for (let x0 = 0; x0 < width; x0 += cell) {
      let sum = 0;
      let count = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      const y1 = Math.min(height, y0 + cell);
      const x1 = Math.min(width, x0 + cell);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          sum += lum(data, i);
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      let l = adjust(sum / Math.max(1, count), p.contrast || 0, Boolean(p.invert));
      const ink = Math.pow(1 - l, Math.max(0.01, p.gamma || 1));
      const radius = ink * maxRadius;
      if (radius < minRadius) continue;
      const cx = x0 + (x1 - x0) / 2 + (rng() - 0.5) * jitter * cell;
      const cy = y0 + (y1 - y0) / 2 + (rng() - 0.5) * jitter * cell;
      const rx = radius * (1 + (rng() - 0.5) * 0.35 * jitter);
      const ry = rx * stretch;
      const color = p.colorMode === "source" ? [r / count, g / count, b / count] : [0, 0, 0];
      drawDot(out, width, height, cx, cy, rx, ry, p.shape || "circle", roundness, color);
    }
  }
  return out;
}

function drawDot(out: Uint8ClampedArray, width: number, height: number, cx: number, cy: number, rx: number, ry: number, shape: string, roundness: number, color: number[]) {
  const xmin = Math.max(0, Math.floor(cx - rx));
  const xmax = Math.min(width - 1, Math.ceil(cx + rx));
  const ymin = Math.max(0, Math.floor(cy - ry));
  const ymax = Math.min(height - 1, Math.ceil(cy + ry));
  const n = shape === "square" ? 12 : shape === "roundedSquare" ? 2 + 10 * (1 - roundness) : 2;
  for (let y = ymin; y <= ymax; y++) {
    for (let x = xmin; x <= xmax; x++) {
      const dx = Math.abs((x - cx) / Math.max(0.001, rx));
      const dy = Math.abs((y - cy) / Math.max(0.001, ry));
      if (Math.pow(dx, n) + Math.pow(dy, n) <= 1) {
        const i = (y * width + x) * 4;
        out[i] = color[0];
        out[i + 1] = color[1];
        out[i + 2] = color[2];
        out[i + 3] = 255;
      }
    }
  }
}

function quantize(data: Uint8ClampedArray, paletteName: string, customPalette: string[]) {
  const colors = paletteName === "custom" ? customPalette : PALETTES[paletteName] || [];
  const palette = colors.map(hexToRgb).filter(Boolean) as number[][];
  if (!palette.length) return data;
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    let best = palette[0];
    let bestDistance = Infinity;
    for (const c of palette) {
      const d = (out[i] - c[0]) ** 2 + (out[i + 1] - c[1]) ** 2 + (out[i + 2] - c[2]) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = c;
      }
    }
    out[i] = best[0];
    out[i + 1] = best[1];
    out[i + 2] = best[2];
  }
  return out;
}

function postFx(data: Uint8ClampedArray, width: number, height: number, fx: any) {
  let out = new Uint8ClampedArray(data);
  const stack = Array.isArray(fx.stack) && fx.stack.length
    ? fx.stack.filter((item: any) => item && item.enabled)
    : [
        { id: "posterize", amount: fx.posterize || 0 },
        { id: "chromaticShift", amount: fx.chromaticShift || 0 },
        { id: "acidGlow", amount: fx.acidGlow || 0 },
        { id: "scanlines", amount: fx.scanlines || 0 },
        { id: "vignette", amount: fx.vignette || 0 },
        { id: "noise", amount: fx.noise || 0 },
      ].filter((item) => item.amount);

  stack.forEach((item: any, index: number) => {
    const amount = Number(item.amount || 0);
    if (item.id === "posterize" && amount > 1) posterize(out, amount);
    else if (item.id === "chromaticShift" && amount !== 0) out = chromaticShift(out, width, height, amount);
    else if (item.id === "acidGlow" && amount > 0) out = acidGlow(out, width, height, amount / 100);
    else if (item.id === "scanlines" && amount > 0) scanlines(out, width, height, amount / 100);
    else if (item.id === "vignette" && amount > 0) vignette(out, width, height, amount / 100);
    else if (item.id === "noise" && amount > 0) noise(out, amount / 100, (fx.seed || 0) + index * 97);
    else if (item.id === "grain" && amount > 0) grain(out, amount / 100, (fx.seed || 0) + index * 131);
    else if (item.id === "sharpen" && amount > 0) out = sharpen(out, width, height, amount / 100);
    else if (item.id === "ascii" && amount > 0) out = ascii(out, width, height, amount / 100);
  });
  return out;
}

function posterize(data: Uint8ClampedArray, levels: number) {
  const step = 255 / (Math.max(2, Math.min(16, levels)) - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
}

function chromaticShift(data: Uint8ClampedArray, width: number, height: number, shift: number) {
  const out = new Uint8ClampedArray(data);
  const s = Math.max(-24, Math.min(24, Math.round(shift)));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out[i] = data[(y * width + ((x - s + width) % width)) * 4];
      out[i + 2] = data[(y * width + ((x + s + width) % width)) * 4 + 2];
    }
  }
  return out;
}

function acidGlow(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const hot = new Uint8ClampedArray(data);
  const threshold = 135 - amount * 42;
  for (let i = 0; i < hot.length; i += 4) {
    const l = 0.2126 * hot[i] + 0.7152 * hot[i + 1] + 0.0722 * hot[i + 2];
    const m = clamp((l - threshold) / Math.max(1, 255 - threshold), 0, 1);
    hot[i] = Math.max(hot[i], 255 * m);
    hot[i + 1] = Math.max(hot[i + 1], (96 + 118 * amount) * m);
    hot[i + 2] *= 1 - 0.92 * m;
  }
  const blur = boxBlur(hot, width, height, Math.max(2, Math.round(6 * amount)));
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = clamp(out[i] + blur[i] * 0.5 * amount);
    out[i + 1] = clamp(out[i + 1] + blur[i + 1] * 0.42 * amount);
    out[i + 2] = clamp(out[i + 2] + blur[i + 2] * 0.25 * amount);
  }
  return out;
}

function scanlines(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  for (let y = 1; y < height; y += 2) {
    const f = 1 - amount * 0.65;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] *= f;
      data[i + 1] *= f;
      data[i + 2] *= f;
    }
  }
}

function vignette(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  for (let y = 0; y < height; y++) {
    const ny = (y / Math.max(1, height - 1)) * 2 - 1;
    for (let x = 0; x < width; x++) {
      const nx = (x / Math.max(1, width - 1)) * 2 - 1;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const f = 1 - clamp((radius - 0.2) / 1.1, 0, 1) * amount;
      const i = (y * width + x) * 4;
      data[i] *= f;
      data[i + 1] *= f;
      data[i + 2] *= f;
    }
  }
}

function noise(data: Uint8ClampedArray, amount: number, seed: number) {
  const rng = seeded(seed);
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() + rng() + rng() - 1.5) * 255 * amount * 0.18;
    data[i] = clamp(data[i] + n);
    data[i + 1] = clamp(data[i + 1] + n);
    data[i + 2] = clamp(data[i + 2] + n);
  }
}

function grain(data: Uint8ClampedArray, amount: number, seed: number) {
  const rng = seeded(seed);
  const strength = 255 * amount * 0.28;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * strength;
    data[i] = clamp(data[i] + n);
    data[i + 1] = clamp(data[i + 1] + n * 0.86);
    data[i + 2] = clamp(data[i + 2] + n * 0.72);
  }
}

function sharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const blur = boxBlur(data, width, height, 1);
  const out = new Uint8ClampedArray(data);
  const strength = 0.35 + amount * 1.35;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = clamp(data[i] + (data[i] - blur[i]) * strength);
    out[i + 1] = clamp(data[i + 1] + (data[i + 1] - blur[i + 1]) * strength);
    out[i + 2] = clamp(data[i + 2] + (data[i + 2] - blur[i + 2]) * strength);
  }
  return out;
}

function ascii(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const out = new Uint8ClampedArray(data);
  const cell = Math.max(4, Math.round(14 - amount * 8));
  const strength = 0.35 + amount * 0.65;
  for (let y0 = 0; y0 < height; y0 += cell) {
    for (let x0 = 0; x0 < width; x0 += cell) {
      const x1 = Math.min(width, x0 + cell);
      const y1 = Math.min(height, y0 + cell);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      r /= Math.max(1, count);
      g /= Math.max(1, count);
      b /= Math.max(1, count);
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const glyph = Math.min(7, Math.max(0, Math.round(l * 7)));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const gx = (x - x0 + 0.5) / Math.max(1, x1 - x0);
          const gy = (y - y0 + 0.5) / Math.max(1, y1 - y0);
          const mark = asciiMark(glyph, gx, gy);
          const i = (y * width + x) * 4;
          const bg = 0.16 + 0.22 * (1 - strength);
          const fg = 0.78 + 0.22 * strength;
          const f = mark ? fg : bg;
          out[i] = clamp(r * f + (mark ? 255 * 0.14 * strength : 0));
          out[i + 1] = clamp(g * f + (mark ? 255 * 0.1 * strength : 0));
          out[i + 2] = clamp(b * f + (mark ? 255 * 0.06 * strength : 0));
          out[i + 3] = 255;
        }
      }
    }
  }
  return out;
}

function asciiMark(glyph: number, x: number, y: number) {
  const cx = Math.abs(x - 0.5);
  const cy = Math.abs(y - 0.5);
  if (glyph <= 0) return false;
  if (glyph === 1) return cx < 0.08 && cy < 0.08;
  if (glyph === 2) return cx < 0.07 && (Math.abs(y - 0.34) < 0.05 || Math.abs(y - 0.66) < 0.05);
  if (glyph === 3) return Math.abs(x - y) < 0.08 || Math.abs(x + y - 1) < 0.08;
  if (glyph === 4) return cx < 0.06 || cy < 0.06;
  if (glyph === 5) return Math.abs(x - y) < 0.1 || Math.abs(x + y - 1) < 0.1 || cy < 0.06;
  if (glyph === 6) return cx < 0.28 || cy < 0.28 || Math.abs(x - y) < 0.08;
  return cx < 0.42 || cy < 0.42 || Math.abs(x - y) < 0.12 || Math.abs(x + y - 1) < 0.12;
}

function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius <= 0) return data;
  const out = new Uint8ClampedArray(data.length);
  const tmp = new Uint32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      const acc = [0, 0, 0, 0];
      for (let dx = -radius; dx <= radius; dx++) {
        const sx = Math.max(0, Math.min(width - 1, x + dx));
        const i = (y * width + sx) * 4;
        acc[0] += data[i];
        acc[1] += data[i + 1];
        acc[2] += data[i + 2];
        acc[3] += data[i + 3];
        count++;
      }
      const o = (y * width + x) * 4;
      tmp[o] = acc[0] / count;
      tmp[o + 1] = acc[1] / count;
      tmp[o + 2] = acc[2] / count;
      tmp[o + 3] = acc[3] / count;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      const acc = [0, 0, 0, 0];
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = Math.max(0, Math.min(height - 1, y + dy));
        const i = (sy * width + x) * 4;
        acc[0] += tmp[i];
        acc[1] += tmp[i + 1];
        acc[2] += tmp[i + 2];
        acc[3] += tmp[i + 3];
        count++;
      }
      const o = (y * width + x) * 4;
      out[o] = acc[0] / count;
      out[o + 1] = acc[1] / count;
      out[o + 2] = acc[2] / count;
      out[o + 3] = acc[3] / count;
    }
  }
  return out;
}

function extractPalette(data: Uint8ClampedArray, width: number, height: number, colorCount: number) {
  const buckets = new Map<string, number>();
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 32000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const r = data[i] >> 3;
      const g = data[i + 1] >> 3;
      const b = data[i + 2] >> 3;
      const key = `${r},${g},${b}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(2, Math.min(16, colorCount)))
    .map(([key]) => {
      const [r, g, b] = key.split(",").map((v) => (Number(v) << 3) + 4);
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    });
}

function hexToRgb(value: string) {
  const raw = value.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

function hex(v: number) {
  return clamp(Math.round(v)).toString(16).padStart(2, "0");
}

function seeded(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
