from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .palette import quantize_to_palette
from .types import ApplyResult


@dataclass(frozen=True)
class ErrorDiffusionParams:
    algorithm: str = "floyd_steinberg"
    levels: int = 2
    contrast: float = 0.0
    brightness: float = 0.0
    gamma: float = 1.0
    serpentine: bool = True
    invert: bool = False
    color_mode: str = "mono"  # mono | source | rgb
    palette: str = "none"
    custom_palette: str = ""


def _luminance01(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum / 255.0


def _adjust_luminance(lum: np.ndarray, p: ErrorDiffusionParams) -> np.ndarray:
    gamma = max(0.2, float(p.gamma))
    lum = np.power(np.clip(lum, 0.0, 1.0), 1.0 / gamma)
    if p.brightness != 0.0:
        lum = lum + float(p.brightness)
    if p.contrast != 0.0:
        lum = (lum - 0.5) * (1.0 + float(p.contrast)) + 0.5
    lum = np.clip(lum, 0.0, 1.0)
    if p.invert:
        lum = 1.0 - lum
    return lum


def _kernel(name: str) -> list[tuple[int, int, float]]:
    if name == "atkinson":
        weight = 1.0 / 8.0
        return [
            (1, 0, weight),
            (2, 0, weight),
            (-1, 1, weight),
            (0, 1, weight),
            (1, 1, weight),
            (0, 2, weight),
        ]
    return [
        (1, 0, 7.0 / 16.0),
        (-1, 1, 3.0 / 16.0),
        (0, 1, 5.0 / 16.0),
        (1, 1, 1.0 / 16.0),
    ]


def _diffuse(lum: np.ndarray, p: ErrorDiffusionParams) -> np.ndarray:
    work = lum.astype(np.float32).copy()
    h, w = work.shape
    levels = max(2, int(p.levels))
    kernel = _kernel(p.algorithm)
    out = np.zeros_like(work, dtype=np.float32)

    for y in range(h):
        reverse = bool(p.serpentine) and y % 2 == 1
        x_range = range(w - 1, -1, -1) if reverse else range(w)
        for x in x_range:
            old = work[y, x]
            new = round(old * (levels - 1)) / float(levels - 1)
            out[y, x] = new
            err = old - new

            for dx, dy, weight in kernel:
                tx = x - dx if reverse else x + dx
                ty = y + dy
                if 0 <= tx < w and 0 <= ty < h:
                    work[ty, tx] += err * weight

    return np.clip(out, 0.0, 1.0)


def apply(rgb: np.ndarray, p: ErrorDiffusionParams | None = None) -> ApplyResult:
    if p is None:
        p = ErrorDiffusionParams()

    algorithm = "atkinson" if p.algorithm == "atkinson" else "floyd_steinberg"
    clean = ErrorDiffusionParams(
        algorithm=algorithm,
        levels=max(2, min(8, int(p.levels))),
        contrast=max(-1.0, min(1.0, float(p.contrast))),
        brightness=max(-1.0, min(1.0, float(p.brightness))),
        gamma=max(0.2, min(4.0, float(p.gamma))),
        serpentine=bool(p.serpentine),
        invert=bool(p.invert),
        color_mode=(p.color_mode or "mono").lower(),
        palette=(p.palette or "none").lower(),
        custom_palette=p.custom_palette,
    )

    if clean.color_mode == "rgb":
        channels = []
        for idx in range(3):
            channel = rgb[..., idx].astype(np.float32) / 255.0
            channel = _adjust_luminance(channel, clean)
            channels.append(_diffuse(channel, clean))
        out = (np.stack(channels, axis=-1) * 255.0).clip(0, 255).astype(np.uint8)
    else:
        lum = _adjust_luminance(_luminance01(rgb), clean)
        dithered = _diffuse(lum, clean)
        if clean.color_mode == "source":
            out = (rgb.astype(np.float32) * dithered[..., None]).clip(0, 255).astype(np.uint8)
        else:
            out = (dithered * 255.0).clip(0, 255).astype(np.uint8)
    out = quantize_to_palette(out, clean.palette, clean.custom_palette)
    return out, {
        "algorithm": clean.algorithm,
        "levels": clean.levels,
        "serpentine": clean.serpentine,
        "color_mode": clean.color_mode,
        "palette": clean.palette,
    }
