from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter


@dataclass(frozen=True)
class PostFxParams:
    noise: float = 0.0
    scanlines: float = 0.0
    chromatic_shift: int = 0
    vignette: float = 0.0
    posterize: int = 0
    acid_glow: float = 0.0
    ascii: float = 0.0
    sharpen: float = 0.0
    grain: float = 0.0
    seed: int = 0
    stack: tuple[dict, ...] = ()


def _to_rgb(arr: np.ndarray) -> tuple[np.ndarray, bool]:
    if arr.ndim == 2:
        return np.repeat(arr[..., None], 3, axis=2).astype(np.float32), True
    return arr.astype(np.float32), False


def _posterize(rgb: np.ndarray, levels: int) -> np.ndarray:
    if levels <= 1:
        return rgb
    levels = max(2, min(16, int(levels)))
    step = 255.0 / float(levels - 1)
    return np.round(rgb / step) * step


def _noise(rgb: np.ndarray, amount: float, seed: int) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb
    rng = np.random.default_rng(int(seed))
    noise = rng.normal(0.0, 255.0 * amount * 0.18, size=rgb.shape)
    return rgb + noise


def _grain(rgb: np.ndarray, amount: float, seed: int) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb
    rng = np.random.default_rng(int(seed))
    grain = rng.uniform(-0.5, 0.5, size=rgb.shape[:2] + (1,)) * 255.0 * amount * 0.28
    tint = np.array([1.0, 0.86, 0.72], dtype=np.float32)
    return rgb + grain * tint


def _scanlines(rgb: np.ndarray, amount: float) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb
    factors = np.ones((rgb.shape[0], 1, 1), dtype=np.float32)
    factors[1::2, :, :] = 1.0 - amount * 0.65
    return rgb * factors


def _chromatic_shift(rgb: np.ndarray, shift: int) -> np.ndarray:
    shift = max(-24, min(24, int(shift)))
    if shift == 0:
        return rgb
    out = rgb.copy()
    out[..., 0] = np.roll(rgb[..., 0], shift, axis=1)
    out[..., 2] = np.roll(rgb[..., 2], -shift, axis=1)
    return out


def _vignette(rgb: np.ndarray, amount: float) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb
    h, w = rgb.shape[:2]
    y = np.linspace(-1.0, 1.0, h, dtype=np.float32)[:, None]
    x = np.linspace(-1.0, 1.0, w, dtype=np.float32)[None, :]
    radius = np.sqrt(x * x + y * y)
    mask = 1.0 - np.clip((radius - 0.2) / 1.1, 0.0, 1.0) * amount
    return rgb * mask[..., None]


def _acid_glow(rgb: np.ndarray, amount: float) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb

    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    threshold = 135.0 - amount * 42.0
    mask = np.clip((lum - threshold) / max(1.0, 255.0 - threshold), 0.0, 1.0)
    hot = rgb.copy()
    hot[..., 0] = np.maximum(hot[..., 0], 255.0 * mask)
    hot[..., 1] = np.maximum(hot[..., 1], (96.0 + 118.0 * amount) * mask)
    hot[..., 2] = hot[..., 2] * (1.0 - 0.92 * mask)

    img = Image.fromarray(hot.clip(0, 255).astype(np.uint8), mode="RGB")
    blur_small = np.array(img.filter(ImageFilter.GaussianBlur(radius=2.0 + 4.0 * amount)), dtype=np.float32)
    blur_big = np.array(img.filter(ImageFilter.GaussianBlur(radius=8.0 + 18.0 * amount)), dtype=np.float32)
    return rgb + blur_small * (0.45 * amount) + blur_big * (0.3 * amount)


def _sharpen(rgb: np.ndarray, amount: float) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb
    img = Image.fromarray(rgb.clip(0, 255).astype(np.uint8), mode="RGB")
    blur = np.array(img.filter(ImageFilter.GaussianBlur(radius=1.0)), dtype=np.float32)
    strength = 0.35 + amount * 1.35
    return rgb + (rgb - blur) * strength


def _ascii(rgb: np.ndarray, amount: float) -> np.ndarray:
    amount = max(0.0, min(1.0, float(amount)))
    if amount <= 0.0:
        return rgb

    h, w = rgb.shape[:2]
    cell = max(4, int(round(14 - amount * 8)))
    strength = 0.35 + amount * 0.65
    out = rgb.copy()
    yy, xx = np.mgrid[0:cell, 0:cell]
    gx = (xx + 0.5) / float(cell)
    gy = (yy + 0.5) / float(cell)

    def mark(glyph: int, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        cx = np.abs(x - 0.5)
        cy = np.abs(y - 0.5)
        if glyph <= 0:
            return np.zeros_like(x, dtype=bool)
        if glyph == 1:
            return (cx < 0.08) & (cy < 0.08)
        if glyph == 2:
            return (cx < 0.07) & ((np.abs(y - 0.34) < 0.05) | (np.abs(y - 0.66) < 0.05))
        if glyph == 3:
            return (np.abs(x - y) < 0.08) | (np.abs(x + y - 1) < 0.08)
        if glyph == 4:
            return (cx < 0.06) | (cy < 0.06)
        if glyph == 5:
            return (np.abs(x - y) < 0.1) | (np.abs(x + y - 1) < 0.1) | (cy < 0.06)
        if glyph == 6:
            return (cx < 0.28) | (cy < 0.28) | (np.abs(x - y) < 0.08)
        return (cx < 0.42) | (cy < 0.42) | (np.abs(x - y) < 0.12) | (np.abs(x + y - 1) < 0.12)

    for y0 in range(0, h, cell):
        for x0 in range(0, w, cell):
            patch = rgb[y0 : min(h, y0 + cell), x0 : min(w, x0 + cell), :]
            avg = patch.reshape(-1, 3).mean(axis=0)
            lum = float((0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]) / 255.0)
            glyph = max(0, min(7, int(round(lum * 7))))
            mask = mark(glyph, gx[: patch.shape[0], : patch.shape[1]], gy[: patch.shape[0], : patch.shape[1]])
            block = np.empty_like(patch)
            bg = 0.16 + 0.22 * (1.0 - strength)
            fg = 0.78 + 0.22 * strength
            block[:] = avg * bg
            block[mask] = avg * fg + np.array([36.0, 26.0, 16.0], dtype=np.float32) * strength
            out[y0 : y0 + patch.shape[0], x0 : x0 + patch.shape[1], :] = block
    return out


def _legacy_stack(p: PostFxParams) -> tuple[dict, ...]:
    return (
        {"id": "posterize", "amount": p.posterize, "enabled": p.posterize > 1},
        {"id": "chromaticShift", "amount": p.chromatic_shift, "enabled": p.chromatic_shift != 0},
        {"id": "ascii", "amount": p.ascii * 100.0, "enabled": p.ascii > 0},
        {"id": "acidGlow", "amount": p.acid_glow * 100.0, "enabled": p.acid_glow > 0},
        {"id": "scanlines", "amount": p.scanlines * 100.0, "enabled": p.scanlines > 0},
        {"id": "vignette", "amount": p.vignette * 100.0, "enabled": p.vignette > 0},
        {"id": "noise", "amount": p.noise * 100.0, "enabled": p.noise > 0},
        {"id": "sharpen", "amount": p.sharpen * 100.0, "enabled": p.sharpen > 0},
        {"id": "grain", "amount": p.grain * 100.0, "enabled": p.grain > 0},
    )


def apply_post_fx(arr: np.ndarray, p: PostFxParams | None = None) -> np.ndarray:
    if p is None:
        p = PostFxParams()

    rgb, was_gray = _to_rgb(arr)
    stack = p.stack or _legacy_stack(p)
    for index, item in enumerate(stack):
        if not item.get("enabled", True):
            continue
        effect_id = str(item.get("id", ""))
        amount = float(item.get("amount", 0.0) or 0.0)
        if effect_id == "posterize" and amount > 1:
            rgb = _posterize(rgb, int(amount))
        elif effect_id == "chromaticShift" and amount != 0:
            rgb = _chromatic_shift(rgb, int(amount))
        elif effect_id == "acidGlow" and amount > 0:
            rgb = _acid_glow(rgb, amount / 100.0)
        elif effect_id == "ascii" and amount > 0:
            rgb = _ascii(rgb, amount / 100.0)
        elif effect_id == "scanlines" and amount > 0:
            rgb = _scanlines(rgb, amount / 100.0)
        elif effect_id == "vignette" and amount > 0:
            rgb = _vignette(rgb, amount / 100.0)
        elif effect_id == "noise" and amount > 0:
            rgb = _noise(rgb, amount / 100.0, p.seed + index * 97)
        elif effect_id == "grain" and amount > 0:
            rgb = _grain(rgb, amount / 100.0, p.seed + index * 131)
        elif effect_id == "sharpen" and amount > 0:
            rgb = _sharpen(rgb, amount / 100.0)
    out = rgb.clip(0, 255).astype(np.uint8)
    has_color_shift = any(str(item.get("id", "")) == "chromaticShift" and item.get("enabled", True) and float(item.get("amount", 0.0) or 0.0) != 0 for item in stack)
    if was_gray and not has_color_shift:
        return out[..., 0]
    return out
