from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
from PIL import Image

from .types import ApplyResult


@dataclass(frozen=True)
class HalftoneParams:
    cell_size: int = 8              # pixel size of the halftone cell
    gamma: float = 1.1              # curve applied to ink amount
    contrast: float = 0.0           # -1..1 contrast on luminance
    min_dot: float = 0.0            # px: skip dots smaller than this radius
    max_radius: float = 4.0         # px at full ink
    shape: str = "circle"           # circle | square | roundedSquare
    roundness: float = 0.5          # 0..1 for roundedSquare
    jitter: float = 0.0             # 0..1 random offset/size jitter
    stretch: float = 1.0            # scale radius on Y (ellipse feel)
    invert: bool = False
    color_mode: str = "mono"        # mono | source
    supersample: int | None = None  # 2 or 4; auto if None


def _luminance01(rgb: np.ndarray) -> np.ndarray:
    # uint8 RGB -> float32 luminance 0..1
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum / 255.0


def _adjust_luminance(lum: np.ndarray, contrast: float, invert: bool) -> np.ndarray:
    # contrast: -1..1, applied around mid-gray
    if contrast != 0.0:
        lum = (lum - 0.5) * (1.0 + contrast) + 0.5
    lum = np.clip(lum, 0.0, 1.0)
    if invert:
        lum = 1.0 - lum
    return lum


def _draw_shape(
    canvas: np.ndarray,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    shape: str,
    roundness: float,
    color: float | np.ndarray = 0.0,
) -> None:
    # canvas is float32 0..1 (1 = white). Draw opaque shapes.
    if rx <= 0.0 or ry <= 0.0:
        return

    xmin = max(0, int(math.floor(cx - rx - 1)))
    xmax = min(canvas.shape[1], int(math.ceil(cx + rx + 1)))
    ymin = max(0, int(math.floor(cy - ry - 1)))
    ymax = min(canvas.shape[0], int(math.ceil(cy + ry + 1)))
    if xmin >= xmax or ymin >= ymax:
        return

    xs = np.arange(xmin, xmax, dtype=np.float32) + 0.5
    ys = np.arange(ymin, ymax, dtype=np.float32) + 0.5
    dx = (xs - cx) / rx
    dy = (ys - cy) / ry

    if shape == "square":
        mask = (np.abs(dx)[None, :] <= 1.0) & (np.abs(dy)[:, None] <= 1.0)
    else:
        # roundedSquare uses superellipse; roundness=0 => square-ish (high n), 1 => circle-ish (low n)
        if shape == "roundedSquare":
            n = 2.0 + (1.0 - np.clip(roundness, 0.0, 1.0)) * 28.0  # 2..30
        else:  # circle fallback
            n = 2.0
        # superellipse formula |x|^n + |y|^n <= 1
        mask = (np.abs(dx)[None, :] ** n + np.abs(dy)[:, None] ** n) <= 1.0

    if not np.any(mask):
        return

    region = canvas[ymin:ymax, xmin:xmax]
    region[mask] = color


def apply(rgb: np.ndarray, p: HalftoneParams | None = None) -> ApplyResult:
    """
    Dot-screen halftone:
    - convert to luminance with contrast/invert
    - average per cell to get ink = (1 - luma)^gamma
    - map to radius, threshold small dots, draw shape per cell
    - render at 2x/4x supersample then downscale for clean edges
    Output: (uint8 grayscale (H, W), meta dict)
    """
    if p is None:
        p = HalftoneParams()

    cell = max(2, int(p.cell_size))
    lum = _luminance01(rgb)
    lum = _adjust_luminance(lum, float(p.contrast), bool(p.invert))

    ss = p.supersample
    if ss is None:
        ss = 4 if cell <= 8 else 2
    ss = 4 if ss >= 4 else 2

    h, w = lum.shape
    color_mode = (p.color_mode or "mono").lower()
    use_color = color_mode == "source"
    canvas_shape = (h * ss, w * ss, 3) if use_color else (h * ss, w * ss)
    canvas = np.ones(canvas_shape, dtype=np.float32)

    max_r_base = max(0.0, float(p.max_radius))
    min_r_base = max(0.0, float(p.min_dot))
    jitter = max(0.0, float(p.jitter))
    roundness = float(p.roundness)
    stretch = max(0.1, float(p.stretch))
    gamma = max(0.01, float(p.gamma))
    shape = (p.shape or "circle").lower()

    # fixed seed keeps jitter deterministic for reproducible output
    rng = np.random.default_rng(0)

    for y0 in range(0, h, cell):
        y1 = min(h, y0 + cell)
        for x0 in range(0, w, cell):
            x1 = min(w, x0 + cell)
            patch = lum[y0:y1, x0:x1]
            luma = float(np.mean(patch))
            ink = pow(max(0.0, 1.0 - luma), gamma)

            base_radius = ink * max_r_base
            base_radius = min(base_radius, 0.8 * cell)  # avoid merging cells too much
            if base_radius < min_r_base:
                continue

            # jitter in cell space (kept small)
            jx = (rng.random() - 0.5) * jitter * cell
            jy = (rng.random() - 0.5) * jitter * cell
            jr = 1.0 + (rng.random() - 0.5) * 0.35 * jitter

            cx = (x0 + (x1 - x0) * 0.5 + jx) * ss
            cy = (y0 + (y1 - y0) * 0.5 + jy) * ss

            rx = base_radius * jr * ss
            ry = base_radius * jr * stretch * ss

            if use_color:
                color = np.mean(rgb[y0:y1, x0:x1].astype(np.float32), axis=(0, 1)) / 255.0
            else:
                color = 0.0
            _draw_shape(canvas, cx, cy, rx, ry, shape, roundness, color)

    hi = (canvas * 255.0).clip(0, 255).astype(np.uint8)
    img_hi = Image.fromarray(hi, mode="RGB" if use_color else "L")
    img_final = img_hi.resize((w, h), Image.Resampling.LANCZOS)
    meta = {}
    return np.array(img_final, dtype=np.uint8), meta
