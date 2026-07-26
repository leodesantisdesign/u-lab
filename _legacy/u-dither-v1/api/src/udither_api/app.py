from __future__ import annotations  # permet d'utiliser des annotations de type avancées

import shutil
import subprocess
import sys
import tempfile
import json
import time
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import FastAPI, Request  # gère les requêtes API
from fastapi.responses import Response  # pour envoyer des réponses HTTP
from fastapi.middleware.cors import CORSMiddleware  # pour gérer les politiques CORS

from .image_io import (
    image_to_np,
)  # fonctions pour le traitement des images
from .filters.halftone_filter import HalftoneParams, apply as apply_halftone
from .filters.bayer_filter import BayerParams, apply as apply_bayer
from .filters.error_diffusion_filter import ErrorDiffusionParams, apply as apply_error_diffusion
from .filters.palette import palette_names, quantize_to_palette
from .filters.post_fx import PostFxParams, apply_post_fx


def _env_info() -> dict:
    info = {
        "executable": sys.executable,
        "sys_path0": sys.path[0] if sys.path else "",
        "versions": {},
    }
    for name in ["numpy", "PIL", "fastapi"]:
        try:
            mod = __import__(name)
            ver = getattr(mod, "__version__", None) or getattr(mod, "VERSION", None)
            info["versions"][name] = str(ver)
        except Exception as e:
            info["versions"][name] = f"missing ({e})"
    return info


_ENV_BOOT = _env_info()
print("[ENV] Python executable:", _ENV_BOOT["executable"])
print("[ENV] sys.path[0]:", _ENV_BOOT["sys_path0"])
print("[ENV] versions:", _ENV_BOOT["versions"])


app = FastAPI(title="U.DITHER API")  # création de l'application FastAPI


def _form_str(form, key: str, default: str) -> str:
    value = form.get(key)
    return default if value is None else str(value)


def _form_int(form, key: str, default: int) -> int:
    try:
        return int(float(_form_str(form, key, str(default))))
    except Exception:
        return default


def _form_float(form, key: str, default: float) -> float:
    try:
        return float(_form_str(form, key, str(default)))
    except Exception:
        return default


def _form_bool(form, key: str, default: bool) -> bool:
    raw = _form_str(form, key, "true" if default else "false").lower()
    return raw in {"1", "true", "yes", "on"}


def _form_fx_stack(form) -> tuple[dict, ...]:
    raw = _form_str(form, "fx_stack", "")
    if not raw:
        return ()
    try:
        parsed = json.loads(raw)
    except Exception:
        return ()
    if not isinstance(parsed, list):
        return ()

    allowed = {"acidGlow", "noise", "scanlines", "sharpen", "grain", "vignette", "posterize", "chromaticShift", "ascii"}
    stack: list[dict] = []
    for item in parsed[:12]:
        if not isinstance(item, dict):
            continue
        effect_id = str(item.get("id", ""))
        if effect_id not in allowed:
            continue
        try:
            amount = float(item.get("amount", 0.0))
        except Exception:
            amount = 0.0
        stack.append({"id": effect_id, "amount": amount, "enabled": bool(item.get("enabled", True))})
    return tuple(stack)


def _np_to_image(arr: np.ndarray) -> Image.Image:
    if arr.ndim == 2:
        return Image.fromarray(arr, mode="L")
    return Image.fromarray(arr, mode="RGB")


def _run_ffmpeg(cmd: list[str]) -> None:
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-4000:])


_ENCODER_CACHE: set[str] | None = None


def _ffmpeg_encoders() -> set[str]:
    global _ENCODER_CACHE
    if _ENCODER_CACHE is not None:
        return _ENCODER_CACHE
    try:
        result = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        _ENCODER_CACHE = {line.split()[1] for line in result.stdout.splitlines() if line.startswith(" V") and len(line.split()) > 1}
    except Exception:
        _ENCODER_CACHE = set()
    return _ENCODER_CACHE


def _video_bitrate(max_width: int, fps: int, quality: str) -> str:
    multipliers = {
        "fast": 0.62,
        "balanced": 0.9,
        "quality": 1.25,
        "archive": 1.7,
    }
    multiplier = multipliers.get(quality, multipliers["balanced"])
    # Dithered footage has hard pixel edges, so it needs a higher bitrate than natural footage.
    kbps = int(max(4500, min(64000, max_width * max(8, fps) * multiplier)))
    return f"{kbps}k"


def _encoder_plan(mode: str, quality: str, max_width: int, fps: int) -> tuple[str, list[str], list[str]]:
    encoders = _ffmpeg_encoders()
    bitrate = _video_bitrate(max_width, fps, quality)
    wants_software = mode == "software" or quality == "archive"
    can_videotoolbox = "h264_videotoolbox" in encoders and not wants_software and mode != "software"

    if can_videotoolbox:
        primary = [
            "-c:v",
            "h264_videotoolbox",
            "-profile:v",
            "high",
            "-b:v",
            bitrate,
            "-maxrate",
            bitrate,
            "-bufsize",
            str(int(bitrate.rstrip("k")) * 2) + "k",
            "-allow_sw",
            "1",
        ]
        fallback = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]
        return "h264_videotoolbox", primary, fallback

    preset = "slow" if quality == "archive" else "faster" if quality == "fast" else "veryfast" if quality == "balanced" else "fast"
    crf = "16" if quality == "archive" else "18" if quality == "quality" else "20" if quality == "fast" else "19"
    primary = ["-c:v", "libx264", "-preset", preset, "-crf", crf, "-tune", "stillimage"]
    return "libx264", primary, primary


def _apply_image_adjust(rgb: np.ndarray, form) -> np.ndarray:
    brightness = _form_float(form, "image_brightness", 0.0)
    contrast = _form_float(form, "image_contrast", 0.0)
    gamma = max(0.4, min(3.0, _form_float(form, "image_gamma", 1.0)))
    saturation = _form_float(form, "image_saturation", 0.0)
    invert = _form_bool(form, "image_invert", False)
    if brightness == 0.0 and contrast == 0.0 and gamma == 1.0 and saturation == 0.0 and not invert:
        return rgb

    work = rgb.astype(np.float32) / 255.0
    work = np.clip(work + brightness, 0.0, 1.0)
    work = np.power(work, 1.0 / gamma)
    work = np.clip((work - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0)
    lum = work[..., 0:1] * 0.2126 + work[..., 1:2] * 0.7152 + work[..., 2:3] * 0.0722
    work = np.clip(lum + (work - lum) * (1.0 + saturation), 0.0, 1.0)
    if invert:
        work = 1.0 - work
    return (work * 255.0).clip(0, 255).astype(np.uint8)


def _render_array_from_form(rgb: np.ndarray, form) -> tuple[np.ndarray, dict, dict]:
    mode_norm = _form_str(form, "mode", "halftone").lower()
    headers: dict[str, str] = {}
    meta = {}
    rgb = _apply_image_adjust(rgb, form)

    if mode_norm == "halftone":
        supersample = _form_int(form, "supersample", 0)
        ss = supersample if supersample >= 2 else None
        params = HalftoneParams(
            cell_size=_form_int(form, "cell_size", 10),
            gamma=_form_float(form, "gamma", 1.1),
            contrast=_form_float(form, "contrast", 0.0),
            min_dot=_form_float(form, "min_dot", 0.0),
            max_radius=_form_float(form, "max_radius", 5.0),
            shape=_form_str(form, "shape", "circle"),
            roundness=_form_float(form, "roundness", 0.5),
            jitter=_form_float(form, "jitter", 0.0),
            stretch=_form_float(form, "stretch", 1.0),
            invert=_form_bool(form, "invert", False),
            color_mode=_form_str(form, "halftone_color_mode", "mono"),
            supersample=ss,
        )
        out, meta = apply_halftone(rgb, params)
        out = quantize_to_palette(out, _form_str(form, "halftone_palette", "none"), _form_str(form, "halftone_custom_palette", ""))
    elif mode_norm == "bayer":
        params = BayerParams(
            matrix=_form_str(form, "bayer_matrix", "bayer8"),
            scale=_form_int(form, "bayer_scale", 4),
            levels=_form_int(form, "bayer_levels", 2),
            contrast=_form_float(form, "bayer_contrast", 0.0),
            invert=_form_bool(form, "bayer_invert", False),
            post_blur=_form_float(form, "bayer_post_blur", 0.0),
            color_mode=_form_str(form, "bayer_color_mode", "mono"),
            palette=_form_str(form, "bayer_palette", "none"),
            custom_palette=_form_str(form, "bayer_custom_palette", ""),
        )
        out, meta = apply_bayer(rgb, params)
    elif mode_norm in {"floyd_steinberg", "atkinson"}:
        params = ErrorDiffusionParams(
            algorithm=mode_norm if mode_norm == "atkinson" else _form_str(form, "diffusion_algorithm", "floyd_steinberg"),
            levels=_form_int(form, "diffusion_levels", 2),
            contrast=_form_float(form, "diffusion_contrast", 0.0),
            brightness=_form_float(form, "diffusion_brightness", 0.0),
            gamma=_form_float(form, "diffusion_gamma", 1.0),
            serpentine=_form_bool(form, "diffusion_serpentine", True),
            invert=_form_bool(form, "diffusion_invert", False),
            color_mode=_form_str(form, "diffusion_color_mode", "mono"),
            palette=_form_str(form, "diffusion_palette", "none"),
            custom_palette=_form_str(form, "diffusion_custom_palette", ""),
        )
        out, meta = apply_error_diffusion(rgb, params)
    else:
        raise ValueError(f"Unknown mode: {mode_norm}")

    out = apply_post_fx(
        out,
        PostFxParams(
            noise=_form_float(form, "fx_noise", 0.0),
            scanlines=_form_float(form, "fx_scanlines", 0.0),
            chromatic_shift=_form_int(form, "fx_chromatic_shift", 0),
            vignette=_form_float(form, "fx_vignette", 0.0),
            posterize=_form_int(form, "fx_posterize", 0),
            acid_glow=_form_float(form, "fx_acid_glow", 0.0),
            ascii=_form_float(form, "fx_ascii", 0.0),
            sharpen=_form_float(form, "fx_sharpen", 0.0),
            grain=_form_float(form, "fx_grain", 0.0),
            seed=_form_int(form, "fx_seed", 0),
            stack=_form_fx_stack(form),
        ),
    )
    return out, meta, headers

# CORS for local dev (Vite default: 5173)
# permet les requêtes cross-origin depuis localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Video-Frames",
        "X-Video-FPS",
        "X-Video-Width",
        "X-Video-Seconds",
        "X-Video-Encoder",
        "X-Video-Quality",
        "X-Video-Extract-Time",
        "X-Video-Render-Time",
        "X-Video-Encode-Time",
        "X-Video-Total-Time",
    ],
)


# Health check endpoint
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/debug_env")
def debug_env():
    return _env_info()


@app.get("/palettes")
def palettes():
    return {"palettes": palette_names()}


@app.post("/render_video")
async def render_video_endpoint(request: Request):
    if not shutil.which("ffmpeg"):
        return Response(status_code=500, content="ffmpeg is not installed")

    started_at = time.perf_counter()
    form = await request.form()
    upload = form.get("file")
    if upload is None or not hasattr(upload, "read"):
        return Response(status_code=400, content="Missing video file")

    fps = max(1, min(25, _form_int(form, "video_fps", 24)))
    max_width = max(160, min(1920, _form_int(form, "video_max_width", 1080)))
    max_seconds = max(1, min(60, _form_int(form, "video_max_seconds", 10)))
    keep_audio = _form_bool(form, "video_keep_audio", True)
    encoder_mode = _form_str(form, "video_encoder", "auto").lower()
    if encoder_mode not in {"auto", "hardware", "software"}:
        encoder_mode = "auto"
    quality_mode = _form_str(form, "video_quality", "balanced").lower()
    if quality_mode not in {"fast", "balanced", "quality", "archive"}:
        quality_mode = "balanced"
    even_video_filter = "pad=ceil(iw/2)*2:ceil(ih/2)*2"
    planned_encoder, primary_encoder_args, fallback_encoder_args = _encoder_plan(encoder_mode, quality_mode, max_width, fps)

    suffix = Path(getattr(upload, "filename", "") or "input.mp4").suffix.lower()
    if suffix not in {".mp4", ".mov", ".webm", ".m4v"}:
        suffix = ".mp4"

    with tempfile.TemporaryDirectory(prefix="u-dither-video-") as tmp:
        root = Path(tmp)
        input_path = root / f"input{suffix}"
        frames_dir = root / "frames"
        rendered_dir = root / "rendered"
        rendered_ext = "bmp"
        frames_dir.mkdir()
        rendered_dir.mkdir()

        input_path.write_bytes(await upload.read())

        extract_started_at = time.perf_counter()
        try:
            _run_ffmpeg(
                [
                    "ffmpeg",
                    "-y",
                    "-t",
                    str(max_seconds),
                    "-i",
                    str(input_path),
                    "-vf",
                    f"fps={fps},scale={max_width}:-2:force_original_aspect_ratio=decrease,{even_video_filter}",
                    str(frames_dir / "%06d.png"),
                ]
            )
        except RuntimeError as exc:
            return Response(status_code=400, content=f"FFmpeg frame extraction failed: {exc}")
        extract_elapsed = time.perf_counter() - extract_started_at

        frame_paths = sorted(frames_dir.glob("*.png"))
        if not frame_paths:
            return Response(status_code=400, content="No frames extracted from video")

        render_started_at = time.perf_counter()
        for index, frame_path in enumerate(frame_paths, start=1):
            try:
                img = Image.open(frame_path).convert("RGB")
                rgb = image_to_np(img)
                out, _, _ = _render_array_from_form(rgb, form)
            except ValueError as exc:
                return Response(status_code=400, content=str(exc))
            except Exception as exc:
                return Response(status_code=500, content=f"Frame render failed at frame {index}: {exc}")
            _np_to_image(out).convert("RGB").save(rendered_dir / f"{index:06d}.{rendered_ext}")
        render_elapsed = time.perf_counter() - render_started_at

        silent_path = root / "rendered_silent.mp4"
        used_encoder = planned_encoder
        encode_started_at = time.perf_counter()
        encode_base_cmd = [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(rendered_dir / f"%06d.{rendered_ext}"),
            "-vf",
            even_video_filter,
        ]
        encode_tail_cmd = [
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(silent_path),
        ]
        try:
            _run_ffmpeg(encode_base_cmd + primary_encoder_args + encode_tail_cmd)
        except RuntimeError as exc:
            if primary_encoder_args == fallback_encoder_args:
                return Response(status_code=500, content=f"FFmpeg MP4 encoding failed: {exc}")
            try:
                used_encoder = "libx264"
                _run_ffmpeg(encode_base_cmd + fallback_encoder_args + encode_tail_cmd)
            except RuntimeError as fallback_exc:
                return Response(status_code=500, content=f"FFmpeg MP4 encoding failed: {fallback_exc}")
        encode_elapsed = time.perf_counter() - encode_started_at

        output_path = root / "rendered.mp4"
        if keep_audio:
            try:
                _run_ffmpeg(
                    [
                        "ffmpeg",
                        "-y",
                        "-i",
                        str(silent_path),
                        "-t",
                        str(max_seconds),
                        "-i",
                        str(input_path),
                        "-map",
                        "0:v:0",
                        "-map",
                        "1:a?",
                        "-c:v",
                        "copy",
                        "-c:a",
                        "copy",
                        "-shortest",
                        "-movflags",
                        "+faststart",
                        str(output_path),
                    ]
                )
            except RuntimeError:
                try:
                    _run_ffmpeg(
                        [
                            "ffmpeg",
                            "-y",
                            "-i",
                            str(silent_path),
                            "-t",
                            str(max_seconds),
                            "-i",
                            str(input_path),
                            "-map",
                            "0:v:0",
                            "-map",
                            "1:a?",
                            "-c:v",
                            "copy",
                            "-c:a",
                            "aac",
                            "-shortest",
                            "-movflags",
                            "+faststart",
                            str(output_path),
                        ]
                    )
                except RuntimeError:
                    output_path = silent_path
        else:
            output_path = silent_path

        total_elapsed = time.perf_counter() - started_at
        headers = {
            "Content-Disposition": 'attachment; filename="u-dither-video.mp4"',
            "X-Video-Frames": str(len(frame_paths)),
            "X-Video-FPS": str(fps),
            "X-Video-Width": str(max_width),
            "X-Video-Seconds": str(max_seconds),
            "X-Video-Encoder": used_encoder,
            "X-Video-Quality": quality_mode,
            "X-Video-Extract-Time": f"{extract_elapsed:.2f}",
            "X-Video-Render-Time": f"{render_elapsed:.2f}",
            "X-Video-Encode-Time": f"{encode_elapsed:.2f}",
            "X-Video-Total-Time": f"{total_elapsed:.2f}",
        }
        return Response(content=output_path.read_bytes(), media_type="video/mp4", headers=headers)
