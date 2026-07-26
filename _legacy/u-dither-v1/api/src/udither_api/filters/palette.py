from __future__ import annotations

import numpy as np
from PIL import Image


PALETTES: dict[str, list[str]] = {
    "none": [],
    "gameboy": ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
    "cga": ["#000000", "#55ffff", "#ff55ff", "#ffffff"],
    "macintosh": ["#000000", "#ffffff"],
    "pico8": [
        "#000000",
        "#1d2b53",
        "#7e2553",
        "#008751",
        "#ab5236",
        "#5f574f",
        "#c2c3c7",
        "#fff1e8",
        "#ff004d",
        "#ffa300",
        "#ffec27",
        "#00e436",
        "#29adff",
        "#83769c",
        "#ff77a8",
        "#ffccaa",
    ],
    "warm_print": ["#15110f", "#6b3428", "#c06c3e", "#e7b65a", "#f6e6c8"],
    "cold_signal": ["#061820", "#123a4a", "#1d6f82", "#5bd7c7", "#f2fff8"],
    "xerox_heat": ["#050201", "#250401", "#7a0900", "#d81f00", "#ff6606", "#ffd15a", "#f4eee1"],
    "acid_orange": ["#070000", "#220100", "#5b0300", "#c11200", "#ff2b00", "#ff6606", "#ffd000", "#fff6c9"],
}


def palette_names() -> list[str]:
    return list(PALETTES.keys())


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        return 0, 0, 0
    return int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)


def parse_custom_palette(value: str) -> list[str]:
    colors: list[str] = []
    for item in (value or "").replace(";", ",").split(","):
        raw = item.strip()
        if not raw:
            continue
        if not raw.startswith("#"):
            raw = f"#{raw}"
        if len(raw) == 7:
            try:
                _hex_to_rgb(raw)
                colors.append(raw.lower())
            except Exception:
                continue
    return colors[:16]


def _palette_array(name: str, custom_palette: str = "") -> np.ndarray | None:
    if (name or "").lower() == "custom":
        colors = parse_custom_palette(custom_palette)
        if not colors:
            return None
        return np.array([_hex_to_rgb(color) for color in colors], dtype=np.float32)

    colors = PALETTES.get((name or "none").lower())
    if not colors:
        return None
    return np.array([_hex_to_rgb(color) for color in colors], dtype=np.float32)


def quantize_to_palette(arr: np.ndarray, palette_name: str, custom_palette: str = "") -> np.ndarray:
    palette = _palette_array(palette_name, custom_palette)
    if palette is None:
        return arr

    if arr.ndim == 2:
        rgb = np.repeat(arr[..., None], 3, axis=2)
    else:
        rgb = arr

    flat = rgb.reshape(-1, 3).astype(np.float32)
    distances = np.sum((flat[:, None, :] - palette[None, :, :]) ** 2, axis=2)
    nearest = palette[np.argmin(distances, axis=1)]
    return nearest.reshape(rgb.shape).clip(0, 255).astype(np.uint8)


def extract_palette(arr: np.ndarray, color_count: int) -> list[str]:
    count = max(2, min(16, int(color_count)))
    if arr.ndim == 2:
        img = Image.fromarray(arr, mode="L").convert("RGB")
    else:
        img = Image.fromarray(arr, mode="RGB")

    img.thumbnail((180, 180), Image.Resampling.LANCZOS)
    quantized = img.quantize(colors=count, method=Image.Quantize.MEDIANCUT).convert("RGB")
    colors = quantized.getcolors(maxcolors=180 * 180) or []
    colors.sort(reverse=True, key=lambda item: item[0])
    return [f"#{r:02x}{g:02x}{b:02x}" for _, (r, g, b) in colors[:count]]
