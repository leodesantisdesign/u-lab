from __future__ import annotations

import io
from PIL import Image
import numpy as np

# Fonctions pour le chargement, la conversion et le redimensionnement des images
def load_image_from_bytes(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    return img

# Convertit une image PIL en un tableau numpy
def image_to_np(img: Image.Image) -> np.ndarray:
    # uint8 RGB (H, W, 3)
    return np.array(img, dtype=np.uint8)

# Convertit un tableau numpy en bytes PNG
def np_to_png_bytes(arr: np.ndarray) -> bytes:
    # arr: uint8 RGB or L
    if arr.ndim == 2:
        img = Image.fromarray(arr, mode="L")
    else:
        img = Image.fromarray(arr, mode="RGB")
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()

# Redimensionne une image pour que son côté le plus long ne dépasse pas max_side
def downscale_for_speed(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    scale = max_side / float(max(w, h))
    nw, nh = int(w * scale), int(h * scale)
    return img.resize((nw, nh), Image.Resampling.LANCZOS)
