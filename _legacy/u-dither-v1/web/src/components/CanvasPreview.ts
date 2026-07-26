import { DEFAULT_PARAMS, type Mode, type ParamsByMode, sanitizeForMode, toBackendPayload } from "../core/modes";
import { FX_DEFAULTS, type FxParams, fxToBackend, sanitizeFx } from "../core/fxParams";
import { DEFAULT_CUSTOM_PALETTE } from "../core/paletteParams";
import { IMAGE_ADJUST_DEFAULTS, imageAdjustToBackend, sanitizeImageAdjust, type ImageAdjustParams } from "../core/imageAdjustParams";
import { downloadBlob } from "../core/api";

const DEBOUNCE_MS = 50;
export type PreviewViewMode = "original" | "output" | "split";

type WorkerRenderResult = { id: number; type: "render"; width: number; height: number; data: Uint8ClampedArray };
type WorkerPaletteResult = { id: number; type: "palette"; colors: string[] };

type TextureRef = {
  texture: WebGLTexture;
  width: number;
  height: number;
};

class WebGlPreviewRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private positionLoc: number;
  private uvLoc: number;
  private resolution = { width: 1, height: 1 };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.program = this.createProgram();
    this.buffer = gl.createBuffer()!;
    this.positionLoc = gl.getAttribLocation(this.program, "aPosition");
    this.uvLoc = gl.getAttribLocation(this.program, "aUv");
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "uTexture"), 0);
  }

  resize(width: number, height: number) {
    this.resolution = { width, height };
    this.gl.viewport(0, 0, width, height);
  }

  clear() {
    this.gl.disable(this.gl.SCISSOR_TEST);
    this.gl.clearColor(0.02, 0.02, 0.02, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  createTexture(source: TexImageSource, width: number, height: number) {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Texture allocation failed");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return { texture, width, height };
  }

  deleteTexture(ref: TextureRef | null) {
    if (ref) this.gl.deleteTexture(ref.texture);
  }

  draw(ref: TextureRef, x: number, y: number, width: number, height: number, clip?: { x: number; y: number; width: number; height: number }) {
    const gl = this.gl;
    if (clip) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(clip.x, this.resolution.height - clip.y - clip.height, clip.width, clip.height);
    } else {
      gl.disable(gl.SCISSOR_TEST);
    }

    const x1 = (x / this.resolution.width) * 2 - 1;
    const x2 = ((x + width) / this.resolution.width) * 2 - 1;
    const y1 = 1 - (y / this.resolution.height) * 2;
    const y2 = 1 - ((y + height) / this.resolution.height) * 2;
    const verts = new Float32Array([
      x1, y1, 0, 0,
      x2, y1, 1, 0,
      x1, y2, 0, 1,
      x1, y2, 0, 1,
      x2, y1, 1, 0,
      x2, y2, 1, 1,
    ]);

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ref.texture);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.uvLoc);
    gl.vertexAttribPointer(this.uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private createProgram() {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, `#version 300 es
      in vec2 aPosition;
      in vec2 aUv;
      out vec2 vUv;
      void main() {
        vUv = aUv;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `);
    const fs = this.compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float;
      uniform sampler2D uTexture;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        outColor = texture(uTexture, vUv);
      }
    `);
    const program = gl.createProgram();
    if (!program) throw new Error("Program allocation failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "WebGL link failed");
    return program;
  }

  private compile(type: number, source: string) {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Shader allocation failed");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) throw new Error(this.gl.getShaderInfoLog(shader) || "WebGL compile failed");
    return shader;
  }
}

export function CanvasPreview(onStatus?: (txt: string) => void) {
  const el = document.createElement("div");
  el.className = "canvasStage";
  const canvas = document.createElement("canvas");
  const fallbackCtx = canvas.getContext("2d", { willReadFrequently: true });
  el.appendChild(canvas);

  const label = document.createElement("div");
  label.className = "canvasOverlayLabel";
  el.appendChild(label);

  const splitLine = document.createElement("div");
  splitLine.className = "splitOverlayLine";
  splitLine.hidden = true;
  el.appendChild(splitLine);

  const splitHandle = document.createElement("div");
  splitHandle.className = "splitOverlayHandle";
  splitHandle.hidden = true;
  splitHandle.innerHTML = `<span></span><strong>DRAG</strong>`;
  el.appendChild(splitHandle);

  const emptyState = document.createElement("div");
  emptyState.className = "canvasEmptyState";
  emptyState.textContent = "Upload an image to generate a preview.";
  el.appendChild(emptyState);

  const processOverlay = document.createElement("div");
  processOverlay.className = "processOverlay";
  processOverlay.innerHTML = `
    <div class="processBox">
      <div class="processHead">
        <div>
          <span>PIPELINE</span>
          <strong id="processTitle">Rendering</strong>
        </div>
      </div>
      <div class="processBar"><span id="processFill"></span></div>
      <div class="processMessage" id="processMessage">Preparing source</div>
      <ol class="processSteps" id="processSteps"></ol>
    </div>
  `;
  el.appendChild(processOverlay);
  const processTitle = processOverlay.querySelector<HTMLElement>("#processTitle")!;
  const processFill = processOverlay.querySelector<HTMLElement>("#processFill")!;
  const processMessage = processOverlay.querySelector<HTMLElement>("#processMessage")!;
  const processSteps = processOverlay.querySelector<HTMLOListElement>("#processSteps")!;

  let renderer: WebGlPreviewRenderer | null = null;
  try {
    renderer = new WebGlPreviewRenderer(canvas);
  } catch {
    renderer = null;
  }

  const worker = new Worker(new URL("../workers/renderWorker.ts", import.meta.url), { type: "module" });
  let requestId = 0;
  const pending = new Map<number, (value: WorkerRenderResult | WorkerPaletteResult) => void>();
  worker.onmessage = (event: MessageEvent<WorkerRenderResult | WorkerPaletteResult>) => {
    const resolve = pending.get(event.data.id);
    if (!resolve) return;
    pending.delete(event.data.id);
    resolve(event.data);
  };

  let currentImg: HTMLImageElement | null = null;
  let sourceTexture: TextureRef | null = null;
  let outputTexture: TextureRef | null = null;
  let outputImageData: ImageData | null = null;
  let outputCanvas: HTMLCanvasElement | null = null;
  let params: ParamsByMode = { ...DEFAULT_PARAMS };
  let fxParams: FxParams = FX_DEFAULTS;
  let imageAdjust: ImageAdjustParams = IMAGE_ADJUST_DEFAULTS;
  let customPalette = [...DEFAULT_CUSTOM_PALETTE];
  let mode: Mode = "halftone";
  let viewMode: PreviewViewMode = "output";
  let lastOutputBlob: Blob | null = null;
  let lastAppliedKey: string | null = null;
  let imageVersion = 0;
  let applyTimer: number | null = null;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let splitRatio = 0.5;
  let dragState: null | { kind: "pan" | "split"; x: number; y: number; startPanX: number; startPanY: number } = null;

  function setProcess(title: string, steps: string[], activeIndex: number) {
    processTitle.textContent = title;
    const progress = Math.min(100, Math.max(8, ((activeIndex + 1) / Math.max(1, steps.length)) * 100));
    processFill.style.width = `${progress}%`;
    processMessage.textContent = steps[Math.min(activeIndex, steps.length - 1)] ?? title;
    processSteps.innerHTML = steps
      .map((step, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "";
        return `<li class="${state}"><span>${String(index + 1).padStart(2, "0")}</span>${step}</li>`;
      })
      .join("");
    processOverlay.style.display = "flex";
  }

  function hideProcess() {
    processOverlay.style.display = "none";
  }

  function resize() {
    const parent = el.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    renderer?.resize(canvas.width, canvas.height);
    drawImage();
  }

  function getImageRect(imgW: number, imgH: number, viewW: number, viewH: number) {
    const scale = Math.min(viewW / imgW, viewH / imgH) * zoom;
    const w = imgW * scale;
    const h = imgH * scale;
    const x = (viewW - w) / 2 + pan.x;
    const y = (viewH - h) / 2 + pan.y;
    return { x, y, w, h };
  }

  function setOverlay(text: string, rect?: { x: number; y: number; w: number; h: number }) {
    label.textContent = text.toUpperCase();
    label.hidden = !text;
    if (rect) {
      label.style.left = `${rect.x + 14}px`;
      label.style.top = `${rect.y + rect.h - 36}px`;
    }
  }

  function drawFallbackImage(source: CanvasImageSource, imgW: number, imgH: number, viewW: number, viewH: number) {
    if (!fallbackCtx) return getImageRect(imgW, imgH, viewW, viewH);
    const rect = getImageRect(imgW, imgH, viewW, viewH);
    fallbackCtx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
    return rect;
  }

  function drawImage() {
    const dpr = window.devicePixelRatio || 1;
    const viewW = canvas.width / dpr;
    const viewH = canvas.height / dpr;
    splitLine.hidden = true;
    splitHandle.hidden = true;

    if (renderer) renderer.clear();
    else if (fallbackCtx) {
      fallbackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fallbackCtx.clearRect(0, 0, viewW, viewH);
      fallbackCtx.fillStyle = "#050505";
      fallbackCtx.fillRect(0, 0, viewW, viewH);
    }

    if (!currentImg) {
      setOverlay("");
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    const srcW = currentImg.naturalWidth || currentImg.width;
    const srcH = currentImg.naturalHeight || currentImg.height;
    const rect = getImageRect(srcW, srcH, viewW, viewH);
    const pxRect = {
      x: Math.round(rect.x * dpr),
      y: Math.round(rect.y * dpr),
      w: Math.round(rect.w * dpr),
      h: Math.round(rect.h * dpr),
    };

    if (renderer && sourceTexture) {
      const showOutput = outputTexture && viewMode !== "original";
      renderer.draw(sourceTexture, pxRect.x, pxRect.y, pxRect.w, pxRect.h);
      if (showOutput && outputTexture) {
        const splitX = pxRect.x + Math.floor(pxRect.w * splitRatio);
        const clip = viewMode === "split" ? { x: splitX, y: pxRect.y, width: Math.ceil(pxRect.x + pxRect.w - splitX), height: pxRect.h } : undefined;
        renderer.draw(outputTexture, pxRect.x, pxRect.y, pxRect.w, pxRect.h, clip);
      }
    } else if (fallbackCtx) {
      const sourceRect = drawFallbackImage(currentImg, srcW, srcH, viewW, viewH);
      if (outputCanvas && viewMode !== "original") {
        if (viewMode === "split") {
          fallbackCtx.save();
          fallbackCtx.beginPath();
          fallbackCtx.rect(sourceRect.x + sourceRect.w * splitRatio, sourceRect.y, sourceRect.w * (1 - splitRatio), sourceRect.h);
          fallbackCtx.clip();
          fallbackCtx.drawImage(outputCanvas, sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h);
          fallbackCtx.restore();
        } else {
          fallbackCtx.drawImage(outputCanvas, sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h);
        }
      }
    }

    if (viewMode === "split" && outputImageData) {
      splitLine.hidden = false;
      splitHandle.hidden = false;
      const splitLeft = rect.x + rect.w * splitRatio;
      splitLine.style.left = `${splitLeft}px`;
      splitLine.style.top = `${rect.y}px`;
      splitLine.style.height = `${rect.h}px`;
      splitHandle.style.left = `${splitLeft}px`;
      splitHandle.style.top = `${Math.max(rect.y + 10, rect.y + rect.h * 0.5 - 34)}px`;
    }
    setOverlay(outputImageData && viewMode === "original" ? "Original" : outputImageData && viewMode === "output" ? "Output" : viewMode === "split" ? "Split" : "Source", rect);
  }

  function canvasImageData(maxSide?: number) {
    if (!currentImg) return null;
    const srcW = currentImg.naturalWidth || currentImg.width;
    const srcH = currentImg.naturalHeight || currentImg.height;
    const scale = maxSide && Math.max(srcW, srcH) > maxSide ? maxSide / Math.max(srcW, srcH) : 1;
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const buffer = document.createElement("canvas");
    buffer.width = w;
    buffer.height = h;
    const bctx = buffer.getContext("2d", { willReadFrequently: true })!;
    bctx.drawImage(currentImg, 0, 0, w, h);
    return bctx.getImageData(0, 0, w, h);
  }

  function renderWorker(imageData: ImageData, maxSide: number) {
    const id = ++requestId;
    const request = new Promise<WorkerRenderResult>((resolve) => pending.set(id, resolve as (value: WorkerRenderResult | WorkerPaletteResult) => void));
    const safeParams = sanitizeForMode(mode, params[mode]);
    worker.postMessage(
      {
        id,
        type: "render",
        mode,
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
        params: safeParams,
        fx: fxParams,
        imageAdjust,
        customPalette,
        maxSide,
      },
      [imageData.data.buffer]
    );
    return request;
  }

  function imageDataToCanvas(data: ImageData) {
    const out = document.createElement("canvas");
    out.width = data.width;
    out.height = data.height;
    out.getContext("2d")!.putImageData(data, 0, 0);
    return out;
  }

  function imageDataToBlob(data: ImageData, mime = "image/png") {
    const out = imageDataToCanvas(data);
    const quality = mime === "image/jpeg" ? 0.94 : undefined;
    return new Promise<Blob | null>((resolve) => out.toBlob((blob) => resolve(blob), mime, quality));
  }

  function setImage(img: HTMLImageElement) {
    currentImg = img;
    imageVersion += 1;
    zoom = 1;
    pan = { x: 0, y: 0 };
    splitRatio = 0.5;
    lastOutputBlob = null;
    outputImageData = null;
    outputCanvas = null;
    lastAppliedKey = null;
    if (renderer) {
      renderer.deleteTexture(sourceTexture);
      sourceTexture = renderer.createTexture(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
    }
    drawImage();
  }

  function setParams<M extends Mode>(m: M, p: ParamsByMode[M]) {
    params = { ...params, [m]: sanitizeForMode(m, p) } as ParamsByMode;
  }

  function setFxParams(next: Partial<FxParams>) {
    fxParams = sanitizeFx({ ...fxParams, ...next });
  }

  function setImageAdjust(next: Partial<ImageAdjustParams>) {
    imageAdjust = sanitizeImageAdjust({ ...imageAdjust, ...next });
  }

  function setCustomPalette(next: string[]) {
    customPalette = next.filter((color) => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 16);
  }

  function getRenderPayload(maxSide: number) {
    const safeParams = sanitizeForMode(mode, params[mode]);
    return {
      ...toBackendPayload(mode, safeParams, maxSide),
      ...imageAdjustToBackend(imageAdjust),
      ...fxToBackend(fxParams),
      halftone_custom_palette: customPalette.join(","),
      bayer_custom_palette: customPalette.join(","),
      diffusion_custom_palette: customPalette.join(","),
    };
  }

  function setMode(next: Mode) {
    if (mode === next) return;
    mode = next;
    queueRender(true);
  }

  function setViewMode(next: PreviewViewMode) {
    viewMode = next;
    drawImage();
  }

  function setZoom(next: number) {
    zoom = Math.max(0.25, Math.min(8, next));
    drawImage();
  }

  function fitView() {
    zoom = 1;
    pan = { x: 0, y: 0 };
    drawImage();
  }

  function actualSize() {
    if (!currentImg) return;
    const srcW = currentImg.naturalWidth || currentImg.width;
    const srcH = currentImg.naturalHeight || currentImg.height;
    const dpr = window.devicePixelRatio || 1;
    const viewW = canvas.width / dpr;
    const viewH = canvas.height / dpr;
    const fitScale = Math.min(viewW / srcW, viewH / srcH);
    zoom = Math.max(0.25, Math.min(8, 1 / Math.max(0.0001, fitScale)));
    pan = { x: 0, y: 0 };
    drawImage();
  }

  function canvasPoint(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function currentDisplayRect() {
    if (!currentImg) return null;
    const dpr = window.devicePixelRatio || 1;
    const viewW = canvas.width / dpr;
    const viewH = canvas.height / dpr;
    return getImageRect(currentImg.naturalWidth || currentImg.width, currentImg.naturalHeight || currentImg.height, viewW, viewH);
  }

  el.addEventListener("pointerdown", (event) => {
    if (!currentImg) return;
    const point = canvasPoint(event);
    const rect = currentDisplayRect();
    if (!rect) return;
    const splitX = rect.x + rect.w * splitRatio;
    const inside = point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
    if (!inside) return;
    dragState = {
      kind: viewMode === "split" && Math.abs(point.x - splitX) < 34 ? "split" : "pan",
      x: point.x,
      y: point.y,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener("pointermove", (event) => {
    const point = canvasPoint(event);
    const rect = currentDisplayRect();
    if (!dragState || !rect) {
      if (viewMode === "split" && rect) {
        const splitX = rect.x + rect.w * splitRatio;
        el.dataset.dragMode = Math.abs(point.x - splitX) < 34 ? "split" : "pan";
      }
      return;
    }
    if (dragState.kind === "split") {
      splitRatio = Math.max(0.04, Math.min(0.96, (point.x - rect.x) / Math.max(1, rect.w)));
    } else {
      pan = { x: dragState.startPanX + point.x - dragState.x, y: dragState.startPanY + point.y - dragState.y };
    }
    drawImage();
  });

  el.addEventListener("pointerup", (event) => {
    dragState = null;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
  });

  el.addEventListener("pointercancel", () => {
    dragState = null;
  });

  el.addEventListener("wheel", (event) => {
    if (!currentImg) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  }, { passive: false });

  function queueRender(force = false) {
    if (!currentImg) return;
    if (applyTimer) window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(() => applyCurrentFilter(force), DEBOUNCE_MS);
  }

  async function applyCurrentFilter(force = false) {
    if (!currentImg) return;
    const safeParams = sanitizeForMode(mode, params[mode]);
    const key = `${mode}-${imageVersion}-${JSON.stringify(safeParams)}-${JSON.stringify(imageAdjust)}-${JSON.stringify(fxParams)}-${customPalette.join("|")}`;
    if (!force && key === lastAppliedKey) return;
    lastAppliedKey = key;

    const steps = ["Rasterize source", "Send to worker", "Render effect", "Upload WebGL texture"];
    setProcess("Image render", steps, 0);
    const source = canvasImageData(1600);
    if (!source) return;
    setProcess("Image render", steps, 1);
    const result = await renderWorker(source, 1600);
    if (result.id !== requestId) return;
    setProcess("Image render", steps, 2);
    outputImageData = new ImageData(new Uint8ClampedArray(result.data), result.width, result.height);
    outputCanvas = imageDataToCanvas(outputImageData);
    lastOutputBlob = await imageDataToBlob(outputImageData);
    if (renderer) {
      renderer.deleteTexture(outputTexture);
      outputTexture = renderer.createTexture(outputImageData, outputImageData.width, outputImageData.height);
    }
    setProcess("Image render", steps, 3);
    drawImage();
    hideProcess();
    onStatus?.(`Mode: ${mode} · worker preview${renderer ? " · WebGL2" : " · Canvas2D"}`);
  }

  async function renderCurrentToBlob(maxSideOverride?: number, mime = "image/png") {
    const source = canvasImageData(maxSideOverride ?? 2400);
    if (!source) return null;
    const result = await renderWorker(source, maxSideOverride ?? 2400);
    return imageDataToBlob(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), mime);
  }

  async function extractPalette(colorCount = 8) {
    const source = canvasImageData(900);
    if (!source) return [];
    const id = ++requestId;
    const request = new Promise<WorkerPaletteResult>((resolve) => pending.set(id, resolve as (value: WorkerRenderResult | WorkerPaletteResult) => void));
    worker.postMessage({ id, type: "palette", width: source.width, height: source.height, data: source.data, colorCount }, [source.data.buffer]);
    const result = await request;
    return result.colors;
  }

  async function exportPNG(filename: string, scale = 1) {
    await exportImage(filename, scale, "image/png");
  }

  async function exportImage(filename: string, scale = 1, mime = "image/png") {
    if (currentImg && scale > 1) {
      const srcW = currentImg.naturalWidth || currentImg.width;
      const srcH = currentImg.naturalHeight || currentImg.height;
      const maxSide = Math.min(6400, Math.max(srcW, srcH) * scale);
      setProcess("High-res export", ["Rasterize source", "Worker render", `Prepare ${mime === "image/jpeg" ? "JPG" : "PNG"}`], 0);
      const hiBlob = await renderCurrentToBlob(maxSide, mime);
      hideProcess();
      if (hiBlob) downloadBlob(hiBlob, filename);
      return;
    }

    if (lastOutputBlob && mime === "image/png") {
      downloadBlob(lastOutputBlob, filename);
      return;
    }

    if (currentImg) {
      const hiBlob = await renderCurrentToBlob(undefined, mime);
      if (hiBlob) downloadBlob(hiBlob, filename);
      return;
    }

    const a = document.createElement("a");
    a.download = filename;
    a.href = canvas.toDataURL(mime);
    a.click();
  }

  requestAnimationFrame(resize);

  return {
    el,
    setImage,
    setParams,
    setFxParams,
    setImageAdjust,
    setCustomPalette,
    setMode,
    setViewMode,
    setZoom,
    fitView,
    actualSize,
    getZoom: () => zoom,
    getMode: () => mode,
    getViewMode: () => viewMode,
    getParams: () => params,
    getFxParams: () => fxParams,
    getImageAdjust: () => imageAdjust,
    getCustomPalette: () => customPalette,
    getRenderPayload,
    queueRender,
    applyCurrentFilter,
    renderCurrentToBlob,
    extractPalette,
    exportPNG,
    exportImage,
    resize,
  };
}
