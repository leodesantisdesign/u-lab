from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import numpy as np
from PIL import Image, ImageFilter

from .palette import quantize_to_palette
from .types import ApplyResult


@dataclass(frozen=True)
class BayerParams:
    matrix: str = "bayer8"  # bayer2 | bayer4 | bayer8 | cross | diamond | lines
    scale: int = 4          # repetition scale of the pattern
    levels: int = 2         # output levels (>=2)
    contrast: float = 0.0   # -1..1
    invert: bool = False
    post_blur: float = 0.0  # 0..1 soft blur radius multiplier
    color_mode: str = "mono"  # mono | source | rgb
    palette: str = "none"
    custom_palette: str = ""


# Standard Bayer matrices
_BAYER2 = np.array([[0, 2], [3, 1]], dtype=np.float32) / 4.0
_BAYER4 = np.array(
    [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ],
    dtype=np.float32,
) / 16.0


def _bayer_from(prev: np.ndarray) -> np.ndarray:
    """Recursive Bayer construction: B2 -> B4 -> B8."""
    t = np.array([[0, 2], [3, 1]], dtype=np.float32)
    new = np.block(
        [
            [4 * prev + t[0, 0], 4 * prev + t[0, 1]],
            [4 * prev + t[1, 0], 4 * prev + t[1, 1]],
        ]
    )
    return new / float(new.size)


_BAYER8 = _bayer_from(_BAYER4 * 16.0)  # undo normalization before recursion


def _cross_matrix() -> np.ndarray:
    base = np.array(
        [
            [0.9, 0.6, 0.7, 0.6, 0.9],
            [0.6, 0.3, 0.2, 0.3, 0.6],
            [0.7, 0.2, 0.0, 0.2, 0.7],
            [0.6, 0.3, 0.2, 0.3, 0.6],
            [0.9, 0.6, 0.7, 0.6, 0.9],
        ],
        dtype=np.float32,
    )
    return base / base.max()


def _diamond_matrix() -> np.ndarray:
    base = np.array(
        [
            [0.8, 0.6, 0.4, 0.6, 0.8],
            [0.6, 0.2, 0.1, 0.2, 0.6],
            [0.4, 0.1, 0.0, 0.1, 0.4],
            [0.6, 0.2, 0.1, 0.2, 0.6],
            [0.8, 0.6, 0.4, 0.6, 0.8],
        ],
        dtype=np.float32,
    )
    return base / base.max()


def _lines_matrix() -> np.ndarray:
    base = np.array(
        [
            [0.1, 0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.3],
            [0.2, 0.4, 0.6, 0.8, 1.0, 0.8, 0.6, 0.4],
        ],
        dtype=np.float32,
    )
    return base / base.max()


_MATRICES: Dict[str, np.ndarray] = {
    "bayer2": _BAYER2,
    "bayer4": _BAYER4,
    "bayer8": _BAYER8,
    "cross": _cross_matrix(),
    "diamond": _diamond_matrix(),
    "lines": _lines_matrix(),
}


def _luminance01(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum / 255.0


def _adjust_luminance(lum: np.ndarray, contrast: float, invert: bool) -> np.ndarray:
    if contrast != 0.0:
        lum = (lum - 0.5) * (1.0 + contrast) + 0.5
    lum = np.clip(lum, 0.0, 1.0)
    if invert:
        lum = 1.0 - lum
    return lum


def _ordered_dither(lum: np.ndarray, thresholds: np.ndarray, levels: int, scale: int) -> np.ndarray:
    h, w = lum.shape
    n_y, n_x = thresholds.shape
    levels = max(2, int(levels))
    y_idx = (np.arange(h) // scale) % n_y
    x_idx = (np.arange(w) // scale) % n_x
    tiled_thresholds = thresholds[y_idx[:, None], x_idx[None, :]]
    quantized = np.floor(lum * float(levels - 1) + tiled_thresholds)
    quantized = np.clip(quantized, 0, levels - 1)
    return quantized.astype(np.float32) / float(levels - 1)


def _ordered_dither_rgb(rgb: np.ndarray, thresholds: np.ndarray, levels: int, scale: int, contrast: float, invert: bool) -> np.ndarray:
    channels = rgb.astype(np.float32) / 255.0
    channels = _adjust_luminance(channels, contrast, invert)
    h, w = channels.shape[:2]
    n_y, n_x = thresholds.shape
    y_idx = (np.arange(h) // scale) % n_y
    x_idx = (np.arange(w) // scale) % n_x
    tiled_thresholds = thresholds[y_idx[:, None], x_idx[None, :]][..., None]
    quantized = np.floor(channels * float(levels - 1) + tiled_thresholds)
    quantized = np.clip(quantized, 0, levels - 1)
    return quantized.astype(np.float32) / float(levels - 1)


def apply(rgb: np.ndarray, p: BayerParams | None = None) -> ApplyResult:
    if p is None:
        p = BayerParams()

    mat = _MATRICES.get(p.matrix, _MATRICES["bayer8"])
    scale = max(1, int(p.scale))
    levels = max(2, int(p.levels))

    color_mode = (p.color_mode or "mono").lower()

    if color_mode == "rgb":
        dithered_rgb = _ordered_dither_rgb(rgb, mat, levels, scale, float(p.contrast), bool(p.invert))
        out = (dithered_rgb * 255.0).clip(0, 255).astype(np.uint8)
    else:
        lum = _luminance01(rgb)
        lum = _adjust_luminance(lum, float(p.contrast), bool(p.invert))
        dithered = _ordered_dither(lum, mat, levels, scale)
        if color_mode == "source":
            mask = dithered[..., None]
            out = (rgb.astype(np.float32) * mask).clip(0, 255).astype(np.uint8)
        else:
            out = (dithered * 255.0).clip(0, 255).astype(np.uint8)

    blur_amount = max(0.0, min(1.0, float(p.post_blur)))
    if blur_amount > 0.0:
        radius = 0.5 + 1.5 * blur_amount
        img = Image.fromarray(out, mode="RGB" if out.ndim == 3 else "L").filter(ImageFilter.GaussianBlur(radius=radius))
        out = np.array(img, dtype=np.uint8)

    out = quantize_to_palette(out, p.palette, p.custom_palette)

    meta = {
        "matrix": p.matrix,
        "levels": levels,
        "scale": scale,
        "palette": p.palette,
    }
    return out, meta
