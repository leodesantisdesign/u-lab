import { CanvasPreview } from "../components/CanvasPreview";
import { ControlsBayer } from "../components/ControlsBayer";
import { ControlsDiffusion } from "../components/ControlsDiffusion";
import { ControlsFx } from "../components/ControlsFx";
import { ControlsHalftone } from "../components/ControlsHalftone";
import { CustomSelect, type CustomSelectOption } from "../components/CustomSelect";
import { CustomPaletteEditor } from "../components/CustomPaletteEditor";
import { ImageUpload } from "../components/ImageUploader";
import { API_BASE, apiUrl, downloadBlob } from "../core/api";
import { IMAGE_ADJUST_DEFAULTS, sanitizeImageAdjust, type ImageAdjustParams } from "../core/imageAdjustParams";
import { type Mode } from "../core/modes";
import { PALETTE_OPTIONS, type PaletteName } from "../core/paletteParams";
import { STUDIO_PRESETS, type StudioPreset } from "../core/presets";
import { applyTooltips } from "../core/tooltips";

type Workspace = "image" | "video";
type PaletteChoice = PaletteName | "source";

const MODE_LABELS: Record<Mode, string> = {
  halftone: "Halftone",
  bayer: "Bayer",
  floyd_steinberg: "Floyd-Steinberg",
  atkinson: "Atkinson",
};

function paletteOption(value: PaletteName) {
  return PALETTE_OPTIONS.find((option) => option.value === value) ?? PALETTE_OPTIONS[0];
}

function swatches(colors: string[]) {
  if (!colors.length) return `<span class="swatchEmpty">full color</span>`;
  return colors.map((color) => `<span class="swatch" title="${color}" style="background:${color}"></span>`).join("");
}

function presetPalette(preset: StudioPreset): PaletteName {
  const params = preset.params as { palette?: PaletteName };
  return preset.palette ?? params.palette ?? "none";
}

function effectName(preset: StudioPreset | null, mode: Mode) {
  return preset ? preset.name : MODE_LABELS[mode];
}

function safeEffect(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
}

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[/:\\]/g, "-").trim() || "untitled";
}

function presetOptions(): CustomSelectOption[] {
  return [
    { value: "manual", label: "Manual", meta: "current look", swatches: ["#111111", "#ff6606", "#f2f2ee"] },
    ...STUDIO_PRESETS.map((preset) => ({
      value: preset.id,
      label: preset.name,
      meta: preset.family,
      swatches: paletteOption(presetPalette(preset)).swatches,
    })),
  ];
}

function engineOptions(): CustomSelectOption[] {
  return [
    { value: "halftone", label: "Halftone", meta: "round dot screen" },
    { value: "bayer", label: "Bayer", meta: "ordered matrix" },
    { value: "floyd_steinberg", label: "Floyd", meta: "error diffusion" },
    { value: "atkinson", label: "Atkinson", meta: "soft vintage" },
  ];
}

function paletteColorMode(mode: Mode, palette: PaletteName) {
  if (mode === "halftone") return palette === "none" || palette === "macintosh" ? "mono" : "source";
  if (mode === "bayer") return palette === "none" ? "source" : palette === "macintosh" ? "mono" : "rgb";
  return palette === "none" ? "source" : palette === "macintosh" ? "mono" : "source";
}

export function StudioPage() {
  const root = document.createElement("div");
  root.className = "shell";

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="brand">
      <div class="brandTop">
        <small>©Léo De-Santis</small>
        <div class="badge">U.DITHER · 01</div>
      </div>
      <h1 class="wordmark"><span>U</span><i>.</i><span>DITHER</span></h1>
      <div class="brandMeta">Create your own dithering style</div>
    </div>

    <section class="sectionBlock sourceBlock">
      <div class="sectionHead">
        <span>01</span>
        <label>SOURCE</label>
      </div>
      <div class="workspaceTabs" role="tablist" aria-label="Workspace">
        <button id="imageTab" class="tab active" type="button">IMAGE</button>
        <button id="videoTab" class="tab" type="button">VIDEO</button>
      </div>
      <div class="sourcePane" id="imagePane">
        <div id="upload"></div>
      </div>
      <div class="sourcePane" id="videoPane" hidden>
        <div class="videoNotice">API <span id="apiBase"></span> · current look is used for preview and export</div>
        <div class="videoUpload">
          <button id="videoPick" class="uploadBtn" type="button">UPLOAD VIDEO</button>
          <input id="videoFile" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" aria-label="Video file" />
          <div class="fileName" id="videoFileName">MP4, MOV, WEBM</div>
        </div>
        <div class="videoGrid compactVideoGrid">
          <label>FPS
            <div id="videoFpsSelect"></div>
          </label>
          <label>WIDTH
            <div id="videoWidthSelect"></div>
          </label>
          <label>SECONDS
            <div id="videoSecondsSelect"></div>
          </label>
          <label>ENCODER
            <div id="videoEncoderSelect"></div>
          </label>
          <label>QUALITY
            <div id="videoQualitySelect"></div>
          </label>
          <label class="videoAudio">
            <input id="videoKeepAudio" type="checkbox" checked />
            KEEP AUDIO
          </label>
        </div>
        <div class="fileName" id="videoStatus" role="status" aria-live="polite">Upload a video to auto-preview 1 second.</div>
      </div>
    </section>

    <section class="sectionBlock">
      <div class="sectionHead">
        <span>02</span>
        <label>LOOK</label>
      </div>
      <div id="presetSelect"></div>
    </section>

    <section class="sectionBlock">
      <div class="sectionHead">
        <span>03</span>
        <label>PALETTE</label>
      </div>
      <div id="paletteSelect"></div>
      <div class="palettePreview" id="palettePreview"></div>
      <div id="customPalette"></div>
      <div class="fileName" id="paletteStatus">Image upload extracts a custom palette automatically.</div>
    </section>

    <section class="sectionBlock">
      <div class="sectionHead">
        <span>04</span>
        <label>ENGINE</label>
      </div>
      <div id="engineSelect"></div>
      <div class="engineParams" id="controls"></div>
    </section>

    <section class="sectionBlock">
      <div class="sectionHead">
        <span>05</span>
        <label>IMAGE TONE</label>
      </div>
      <div class="toneControls" id="toneControls">
        <div class="ctrl">
          <label>BRIGHTNESS</label>
          <div class="row">
            <input id="imageBrightness" type="range" min="-50" max="50" step="1" value="${IMAGE_ADJUST_DEFAULTS.brightness}" />
            <div id="imageBrightnessVal" class="pillVal">${IMAGE_ADJUST_DEFAULTS.brightness}</div>
          </div>
        </div>
        <div class="ctrl">
          <label>CONTRAST</label>
          <div class="row">
            <input id="imageContrast" type="range" min="-50" max="50" step="1" value="${IMAGE_ADJUST_DEFAULTS.contrast}" />
            <div id="imageContrastVal" class="pillVal">${IMAGE_ADJUST_DEFAULTS.contrast}</div>
          </div>
        </div>
        <div class="ctrl">
          <label>GAMMA</label>
          <div class="row">
            <input id="imageGamma" type="range" min="0.4" max="3" step="0.05" value="${IMAGE_ADJUST_DEFAULTS.gamma}" />
            <div id="imageGammaVal" class="pillVal">${IMAGE_ADJUST_DEFAULTS.gamma.toFixed(2)}</div>
          </div>
        </div>
        <div class="ctrl">
          <label>SATURATION</label>
          <div class="row">
            <input id="imageSaturation" type="range" min="-100" max="100" step="1" value="${IMAGE_ADJUST_DEFAULTS.saturation}" />
            <div id="imageSaturationVal" class="pillVal">${IMAGE_ADJUST_DEFAULTS.saturation}</div>
          </div>
        </div>
        <div class="ctrl splitCtrl">
          <label>INVERT IMAGE</label>
          <label class="switch">
            <input id="imageInvert" type="checkbox" ${IMAGE_ADJUST_DEFAULTS.invert ? "checked" : ""}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </section>

    <section class="sectionBlock">
      <div class="sectionHead">
        <span>06</span>
        <label>FX STACK</label>
      </div>
      <div id="fxControls"></div>
    </section>

    <div class="outputBar">
      <div class="imageExportControls">
        <div id="exportFormatSelect"></div>
        <div id="exportScaleSelect"></div>
        <button id="exportImage" type="button">EXPORT IMAGE</button>
      </div>
      <div class="videoExportControls">
        <button id="renderVideo" class="primary" type="button">RENDER VIDEO</button>
        <a class="downloadLink" id="videoDownload" href="#" download hidden>DOWNLOAD MP4</a>
      </div>
      <div class="videoSettings" id="videoSettings">No video render yet.</div>
    </div>
  `;

  const preview = document.createElement("div");
  preview.className = "preview";
  preview.innerHTML = `
    <div class="previewTop">
      <div class="previewTitle">
        <span>PREVIEW</span>
        <strong id="modeLabel">Acid Orange</strong>
      </div>
      <div class="previewState" id="workspaceLabel">IMAGE</div>
      <div class="previewTools" id="viewBar">
        <button class="viewBtn" data-view="original" type="button">ORIGINAL</button>
        <button class="viewBtn active" data-view="output" type="button">OUTPUT</button>
        <button class="viewBtn" data-view="split" type="button">SPLIT</button>
      </div>
      <div class="previewTools zoomBar" id="zoomBar">
        <button class="viewBtn" data-zoom="out" type="button">-</button>
        <button class="viewBtn" data-zoom="fit" type="button">FIT</button>
        <button class="viewBtn" data-zoom="actual" type="button">100%</button>
        <button class="viewBtn" data-zoom="in" type="button">+</button>
      </div>
    </div>
    <div class="canvasWrap" id="canvasWrap">
      <div class="videoStage" id="videoStage" hidden>
        <div class="videoEmpty">Upload a video to generate a preview.</div>
      </div>
      <div class="videoProcessOverlay" id="videoProcess" hidden>
        <span>VIDEO PIPELINE</span>
        <strong id="videoProcessTitle">Preparing video</strong>
        <div class="processBar"><i id="videoProcessFill"></i></div>
        <div class="processMessage" id="videoProcessMessage">Read clip</div>
      </div>
    </div>
  `;

  root.appendChild(panel);
  root.appendChild(preview);

  const canvasWrap = preview.querySelector<HTMLDivElement>("#canvasWrap")!;
  const videoStage = preview.querySelector<HTMLDivElement>("#videoStage")!;
  const modeLabel = preview.querySelector<HTMLElement>("#modeLabel")!;
  const workspaceLabel = preview.querySelector<HTMLDivElement>("#workspaceLabel")!;
  const viewBar = preview.querySelector<HTMLDivElement>("#viewBar")!;
  const zoomBar = preview.querySelector<HTMLDivElement>("#zoomBar")!;
  const canvasComp = CanvasPreview();
  canvasWrap.prepend(canvasComp.el);

  const resizeHandler = () => canvasComp.resize();
  window.addEventListener("resize", resizeHandler);
  requestAnimationFrame(resizeHandler);

  const controlsHost = panel.querySelector<HTMLDivElement>("#controls")!;
  const fxHost = panel.querySelector<HTMLDivElement>("#fxControls")!;
  const presetSelectHost = panel.querySelector<HTMLDivElement>("#presetSelect")!;
  const paletteSelectHost = panel.querySelector<HTMLDivElement>("#paletteSelect")!;
  const palettePreview = panel.querySelector<HTMLDivElement>("#palettePreview")!;
  const paletteStatus = panel.querySelector<HTMLDivElement>("#paletteStatus")!;
  const engineSelectHost = panel.querySelector<HTMLDivElement>("#engineSelect")!;
  const imageTab = panel.querySelector<HTMLButtonElement>("#imageTab")!;
  const videoTab = panel.querySelector<HTMLButtonElement>("#videoTab")!;
  const imagePane = panel.querySelector<HTMLDivElement>("#imagePane")!;
  const videoPane = panel.querySelector<HTMLDivElement>("#videoPane")!;
  const videoInput = panel.querySelector<HTMLInputElement>("#videoFile")!;
  const videoFileName = panel.querySelector<HTMLDivElement>("#videoFileName")!;
  const videoStatus = panel.querySelector<HTMLDivElement>("#videoStatus")!;
  const videoSettings = panel.querySelector<HTMLDivElement>("#videoSettings")!;
  const videoDownload = panel.querySelector<HTMLAnchorElement>("#videoDownload")!;
  const renderVideoBtn = panel.querySelector<HTMLButtonElement>("#renderVideo")!;
  const videoPickBtn = panel.querySelector<HTMLButtonElement>("#videoPick")!;
  const imageExportControls = panel.querySelector<HTMLDivElement>(".imageExportControls")!;
  const videoExportControls = panel.querySelector<HTMLDivElement>(".videoExportControls")!;
  const videoProcess = preview.querySelector<HTMLDivElement>("#videoProcess")!;
  const videoProcessTitle = preview.querySelector<HTMLElement>("#videoProcessTitle")!;
  const videoProcessFill = preview.querySelector<HTMLElement>("#videoProcessFill")!;
  const videoProcessMessage = preview.querySelector<HTMLElement>("#videoProcessMessage")!;
  const apiBase = panel.querySelector<HTMLSpanElement>("#apiBase")!;
  apiBase.textContent = API_BASE.replace(/^https?:\/\//, "");

  const presetSelect = CustomSelect({
    ariaLabel: "Look preset",
    value: "acid-orange",
    options: presetOptions(),
    className: "presetCustomSelect",
    onChange: (value) => {
      const preset = STUDIO_PRESETS.find((item) => item.id === value);
      if (preset) applyPreset(preset);
      else markManual();
    },
  });
  presetSelectHost.appendChild(presetSelect.el);

  const engineSelect = CustomSelect({
    ariaLabel: "Dithering engine",
    value: "bayer",
    options: engineOptions(),
    onChange: (value) => showMode(value as Mode),
  });
  engineSelectHost.appendChild(engineSelect.el);

  const videoFpsSelect = CustomSelect({
    ariaLabel: "Video FPS",
    value: "24",
    options: [
      { value: "24", label: "24", meta: "cinema" },
      { value: "25", label: "25", meta: "PAL/web" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#videoFpsSelect")!.appendChild(videoFpsSelect.el);

  const videoWidthSelect = CustomSelect({
    ariaLabel: "Video width",
    value: "1080",
    options: [
      { value: "480", label: "480", meta: "preview" },
      { value: "720", label: "720", meta: "fast HD" },
      { value: "1080", label: "1080", meta: "default" },
      { value: "1440", label: "1440", meta: "large" },
      { value: "1920", label: "1920", meta: "full HD" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#videoWidthSelect")!.appendChild(videoWidthSelect.el);

  const videoSecondsSelect = CustomSelect({
    ariaLabel: "Video seconds",
    value: "10",
    options: ["5", "10", "20", "30", "45", "60"].map((value) => ({ value, label: value, meta: "seconds" })),
    onChange: () => undefined,
  });
  panel.querySelector("#videoSecondsSelect")!.appendChild(videoSecondsSelect.el);

  const videoEncoderSelect = CustomSelect({
    ariaLabel: "Video encoder",
    value: "auto",
    options: [
      { value: "auto", label: "Auto", meta: "best available" },
      { value: "hardware", label: "Hardware", meta: "fast Mac H.264" },
      { value: "software", label: "Software", meta: "stable x264" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#videoEncoderSelect")!.appendChild(videoEncoderSelect.el);

  const videoQualitySelect = CustomSelect({
    ariaLabel: "Video quality",
    value: "quality",
    options: [
      { value: "fast", label: "Fast", meta: "lighter" },
      { value: "balanced", label: "Balanced", meta: "default alt" },
      { value: "quality", label: "Quality", meta: "clean edges" },
      { value: "archive", label: "Archive", meta: "slower" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#videoQualitySelect")!.appendChild(videoQualitySelect.el);

  const exportFormatSelect = CustomSelect({
    ariaLabel: "Image export format",
    value: "image/png",
    options: [
      { value: "image/png", label: "PNG", meta: "lossless" },
      { value: "image/jpeg", label: "JPG", meta: "lighter" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#exportFormatSelect")!.appendChild(exportFormatSelect.el);

  const exportScaleSelect = CustomSelect({
    ariaLabel: "Image export scale",
    value: "1",
    options: [
      { value: "1", label: "1X", meta: "native" },
      { value: "2", label: "2X", meta: "large" },
      { value: "4", label: "4X", meta: "poster" },
    ],
    onChange: () => undefined,
  });
  panel.querySelector("#exportScaleSelect")!.appendChild(exportScaleSelect.el);

  let activePreset: StudioPreset | null = null;
  let currentImageBaseName = "untitled";
  let currentVideoBaseName = "untitled-video";
  let sourcePaletteColors: string[] = [];
  let currentPalette: PaletteName = "none";
  let syncingPaletteEditor = false;
  let paletteEditorReady = false;
  let videoPreviewUrl: string | null = null;
  let videoDownloadUrl: string | null = null;
  let videoTicker: number | null = null;
  let paletteSelect: ReturnType<typeof CustomSelect>;

  const halftoneControls = ControlsHalftone((state) => {
    canvasComp.setParams("halftone", state);
    if (canvasComp.getMode() === "halftone") canvasComp.queueRender();
  });
  const bayerControls = ControlsBayer((state) => {
    canvasComp.setParams("bayer", state);
    if (canvasComp.getMode() === "bayer") canvasComp.queueRender();
  });
  const floydControls = ControlsDiffusion("floyd_steinberg", (state) => {
    canvasComp.setParams("floyd_steinberg", state);
    if (canvasComp.getMode() === "floyd_steinberg") canvasComp.queueRender();
  });
  const atkinsonControls = ControlsDiffusion("atkinson", (state) => {
    canvasComp.setParams("atkinson", state);
    if (canvasComp.getMode() === "atkinson") canvasComp.queueRender();
  });
  const fxControls = ControlsFx((state) => {
    canvasComp.setFxParams(state);
    canvasComp.queueRender();
  });
  fxHost.appendChild(fxControls.el);

  const customPalette = CustomPaletteEditor((colors) => {
    canvasComp.setCustomPalette(colors);
    if (!syncingPaletteEditor && paletteEditorReady) {
      currentPalette = "custom";
      paletteSelect.setOptions(paletteOptions(), "custom");
      palettePreview.innerHTML = swatches(colors);
      applyPaletteToMode(canvasComp.getMode(), "custom");
      markManual();
    }
  });
  paletteEditorReady = true;
  panel.querySelector("#customPalette")!.appendChild(customPalette.el);

  function paletteOptions(): CustomSelectOption[] {
    return [
      {
        value: "source",
        label: "Source image",
        meta: sourcePaletteColors.length ? "extracted colors" : "upload first",
        swatches: sourcePaletteColors,
        disabled: sourcePaletteColors.length === 0,
      },
      ...PALETTE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        meta: option.value === "custom" ? "editable" : "palette",
        swatches: option.value === "custom" ? customPalette.getColors() : option.swatches,
      })),
    ];
  }

  paletteSelect = CustomSelect({
    ariaLabel: "Palette",
    value: "acid_orange",
    options: paletteOptions(),
    className: "paletteCustomSelect",
    onChange: (value) => setPaletteChoice(value as PaletteChoice),
  });
  paletteSelectHost.appendChild(paletteSelect.el);

  const blocks: Record<Mode, HTMLElement> = {
    halftone: halftoneControls.el,
    bayer: bayerControls.el,
    floyd_steinberg: floydControls.el,
    atkinson: atkinsonControls.el,
  };

  function markManual() {
    activePreset = null;
    presetSelect.setValue("manual");
    modeLabel.textContent = MODE_LABELS[canvasComp.getMode()];
  }

  function updateModeControls(mode: Mode, next: any) {
    if (mode === "halftone") halftoneControls.updateExternal(next);
    else if (mode === "bayer") bayerControls.updateExternal(next);
    else if (mode === "floyd_steinberg") floydControls.updateExternal(next);
    else atkinsonControls.updateExternal(next);
  }

  function applyPaletteToMode(mode: Mode, palette: PaletteName) {
    const current = canvasComp.getParams()[mode] as any;
    const next = {
      ...current,
      colorMode: paletteColorMode(mode, palette),
      ...(mode !== "halftone" ? { palette } : { shape: "circle", roundness: 100, palette }),
    };
    updateModeControls(mode, next);
    canvasComp.queueRender(true);
  }

  function renderPalettePreview(choice: PaletteChoice) {
    const colors = choice === "source" ? sourcePaletteColors : choice === "custom" ? customPalette.getColors() : paletteOption(choice).swatches;
    palettePreview.innerHTML = swatches(colors);
  }

  function setPaletteChoice(choice: PaletteChoice, options: { syncEditor?: boolean; manual?: boolean } = {}) {
    const renderPalette = choice === "source" ? "custom" : choice;
    currentPalette = renderPalette;
    paletteSelect.setOptions(paletteOptions(), choice);
    if (choice === "source") {
      syncingPaletteEditor = true;
      customPalette.setColors(sourcePaletteColors);
      syncingPaletteEditor = false;
    } else if (options.syncEditor !== false && choice !== "custom") {
      const colors = paletteOption(choice).swatches;
      if (colors.length) {
        syncingPaletteEditor = true;
        customPalette.setColors(colors);
        syncingPaletteEditor = false;
      }
    }
    renderPalettePreview(choice);
    applyPaletteToMode(canvasComp.getMode(), renderPalette);
    if (options.manual !== false) markManual();
  }

  function showMode(mode: Mode, clearPreset = true) {
    if (clearPreset) markManual();
    controlsHost.innerHTML = "";
    controlsHost.appendChild(blocks[mode]);
    engineSelect.setValue(mode);
    canvasComp.setMode(mode);
    applyPaletteToMode(mode, currentPalette);
    modeLabel.textContent = activePreset ? activePreset.name : MODE_LABELS[mode];
    applyTooltips(controlsHost);
  }

  function applyPreset(preset: StudioPreset) {
    activePreset = preset;
    presetSelect.setValue(preset.id);
    const current = canvasComp.getParams()[preset.mode];
    updateModeControls(preset.mode, { ...current, ...preset.params } as any);
    if (preset.fx) fxControls.updateExternal({ ...canvasComp.getFxParams(), ...preset.fx });
    const nextPalette = presetPalette(preset);
    showMode(preset.mode, false);
    setPaletteChoice(nextPalette, { manual: false });
    modeLabel.textContent = preset.name;
    canvasComp.queueRender(true);
  }

  function setWorkspace(next: Workspace) {
    imageTab.classList.toggle("active", next === "image");
    videoTab.classList.toggle("active", next === "video");
    imagePane.hidden = next !== "image";
    videoPane.hidden = next !== "video";
    workspaceLabel.textContent = next.toUpperCase();
    canvasComp.el.hidden = next === "video";
    videoStage.hidden = next === "image";
    viewBar.hidden = next === "video";
    zoomBar.hidden = next === "video";
    imageExportControls.hidden = next !== "image";
    videoExportControls.hidden = next !== "video";
    videoSettings.hidden = next !== "video";
    root.dataset.workspace = next;
    if (next === "image") {
      videoProcess.hidden = true;
      canvasComp.resize();
    }
  }

  async function autoExtractPalette() {
    paletteStatus.textContent = "Extracting image colors...";
    const colors = await canvasComp.extractPalette(8);
    if (!colors.length) {
      paletteStatus.textContent = "No image colors extracted.";
      return;
    }
    sourcePaletteColors = colors;
    syncingPaletteEditor = true;
    customPalette.setColors(colors);
    syncingPaletteEditor = false;
    paletteSelect.setOptions(paletteOptions(), "source");
    setPaletteChoice("source", { syncEditor: false, manual: false });
    paletteStatus.textContent = `${colors.length} source colors extracted and applied.`;
  }

  function setVideoPlaceholder(text: string) {
    videoStage.innerHTML = `<div class="videoEmpty">${text}</div>`;
  }

  preview.querySelectorAll<HTMLButtonElement>("#viewBar button").forEach((btn) => {
    btn.onclick = () => {
      const view = btn.dataset.view as "original" | "output" | "split";
      canvasComp.setViewMode(view);
      for (const item of preview.querySelectorAll<HTMLButtonElement>("#viewBar button")) {
        item.classList.toggle("active", item === btn);
      }
    };
  });

  preview.querySelectorAll<HTMLButtonElement>("#zoomBar button").forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.zoom;
      if (action === "out") canvasComp.setZoom(canvasComp.getZoom() / 1.25);
      else if (action === "in") canvasComp.setZoom(canvasComp.getZoom() * 1.25);
      else if (action === "actual") canvasComp.actualSize();
      else canvasComp.fitView();
    };
  });

  function emitImageAdjust() {
    const next: ImageAdjustParams = sanitizeImageAdjust({
      brightness: Number(panel.querySelector<HTMLInputElement>("#imageBrightness")!.value),
      contrast: Number(panel.querySelector<HTMLInputElement>("#imageContrast")!.value),
      gamma: Number(panel.querySelector<HTMLInputElement>("#imageGamma")!.value),
      saturation: Number(panel.querySelector<HTMLInputElement>("#imageSaturation")!.value),
      invert: panel.querySelector<HTMLInputElement>("#imageInvert")!.checked,
    });
    panel.querySelector<HTMLDivElement>("#imageBrightnessVal")!.textContent = String(next.brightness);
    panel.querySelector<HTMLDivElement>("#imageContrastVal")!.textContent = String(next.contrast);
    panel.querySelector<HTMLDivElement>("#imageGammaVal")!.textContent = next.gamma.toFixed(2);
    panel.querySelector<HTMLDivElement>("#imageSaturationVal")!.textContent = String(next.saturation);
    canvasComp.setImageAdjust(next);
    canvasComp.queueRender(true);
  }

  ["imageBrightness", "imageContrast", "imageGamma", "imageSaturation"].forEach((id) => {
    panel.querySelector<HTMLInputElement>(`#${id}`)!.oninput = emitImageAdjust;
  });
  panel.querySelector<HTMLInputElement>("#imageInvert")!.onchange = emitImageAdjust;

  panel.querySelector("#upload")!.appendChild(
    ImageUpload((img, file) => {
      currentImageBaseName = fileStem(file.name);
      setWorkspace("image");
      canvasComp.setImage(img);
      canvasComp.queueRender(true);
      void autoExtractPalette();
    })
  );

  imageTab.onclick = () => setWorkspace("image");
  videoTab.onclick = () => setWorkspace("video");

  panel.querySelector<HTMLButtonElement>("#exportImage")!.onclick = () => {
    const scale = Number(exportScaleSelect.getValue());
    const mime = exportFormatSelect.getValue();
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    const effect = safeEffect(effectName(activePreset, canvasComp.getMode()));
    const suffix = scale > 1 ? `-${scale}x` : "";
    void canvasComp.exportImage(`${currentImageBaseName}-u.dither-effect:${effect}${suffix}.${ext}`, scale, mime);
  };

  videoPickBtn.onclick = () => videoInput.click();
  videoInput.onchange = () => {
    const file = videoInput.files?.[0];
    setWorkspace("video");
    if (file) currentVideoBaseName = fileStem(file.name);
    videoFileName.textContent = file ? file.name : "MP4, MOV, WEBM";
    videoStatus.textContent = file ? "Auto-previewing first second..." : "Upload a video to auto-preview 1 second.";
    if (file) void renderVideo(true);
  };

  function setVideoBusy(isBusy: boolean) {
    renderVideoBtn.disabled = isBusy;
    videoPickBtn.disabled = isBusy;
  }

  function setVideoProcess(title: string, steps: string[], activeIndex: number) {
    videoProcess.hidden = false;
    videoProcessTitle.textContent = title;
    videoProcessMessage.textContent = steps[Math.min(activeIndex, steps.length - 1)] ?? title;
    videoProcessFill.style.width = `${Math.min(100, Math.max(8, ((activeIndex + 1) / Math.max(1, steps.length)) * 100))}%`;
  }

  function hideVideoProcess() {
    if (videoTicker) {
      window.clearInterval(videoTicker);
      videoTicker = null;
    }
    videoProcess.hidden = true;
  }

  function startVideoTicker(title: string, steps: string[]) {
    let active = 0;
    setVideoProcess(title, steps, active);
    if (videoTicker) window.clearInterval(videoTicker);
    videoTicker = window.setInterval(() => {
      active = Math.min(active + 1, steps.length - 2);
      setVideoProcess(title, steps, active);
    }, 900);
  }

  async function renderVideo(previewOnly: boolean) {
    const file = videoInput.files?.[0];
    if (!file) {
      setWorkspace("video");
      videoStatus.textContent = "Select a video first.";
      setVideoPlaceholder("Upload a video to generate a preview.");
      return;
    }

    setWorkspace("video");
    const selectedFps = videoFpsSelect.getValue();
    const selectedWidth = videoWidthSelect.getValue();
    const selectedSeconds = videoSecondsSelect.getValue();
    const selectedEncoder = videoEncoderSelect.getValue();
    const selectedQuality = videoQualitySelect.getValue();
    const fps = previewOnly ? "8" : selectedFps;
    const width = previewOnly ? "480" : selectedWidth;
    const seconds = previewOnly ? "1" : selectedSeconds;
    const encoder = previewOnly ? "auto" : selectedEncoder;
    const quality = previewOnly ? "fast" : selectedQuality;
    const keepAudio = !previewOnly && panel.querySelector<HTMLInputElement>("#videoKeepAudio")!.checked;
    const currentMode = canvasComp.getMode();
    const currentLookName = activePreset ? activePreset.name : MODE_LABELS[currentMode];
    const estimatedFrames = Number(fps) * Number(seconds);
    const pixelFactor = (Number(width) / 720) ** 2;
    const qualityFactor = quality === "archive" ? 1.35 : quality === "quality" ? 1.15 : quality === "fast" ? 0.82 : 1;
    const engineFactor = currentMode === "bayer" ? 0.105 : currentMode === "atkinson" ? 0.2 : currentMode === "floyd_steinberg" ? 0.28 : 0.42;
    const estimatedSeconds = Math.max(2, Math.round(estimatedFrames * pixelFactor * qualityFactor * engineFactor));
    const estimate = previewOnly ? "< 10s expected" : `about ${Math.max(3, Math.round(estimatedSeconds * 0.75))}-${Math.max(5, Math.round(estimatedSeconds * 1.45))}s expected`;
    const fd = new FormData();
    fd.append("file", file, file.name);
    Object.entries(canvasComp.getRenderPayload(Number(width))).forEach(([key, value]) => fd.append(key, value));
    fd.append("video_fps", fps);
    fd.append("video_max_width", width);
    fd.append("video_max_seconds", seconds);
    fd.append("video_keep_audio", String(keepAudio));
    fd.append("video_encoder", encoder);
    fd.append("video_quality", quality);

    const steps = previewOnly
      ? ["Read clip", "Extract 1s frames", "Apply current look", "Encode preview MP4", "Load preview"]
      : ["Read clip", "Extract frames", "Apply current look", "Encode final MP4", "Prepare download link"];
    const title = previewOnly ? "Preview render" : "Video export";
    setVideoBusy(true);
    startVideoTicker(title, steps);
    videoSettings.textContent = `${currentLookName} · ${seconds}s · ${fps}fps · ${width}px · ${encoder}/${quality} · ${keepAudio ? "audio on" : "audio off"} · ${estimate}`;
    videoStatus.textContent = `${previewOnly ? "Previewing" : "Rendering"} ${seconds}s · ${fps}fps · ${width}px...`;
    if (!previewOnly) {
      videoDownload.hidden = true;
      if (videoDownloadUrl) URL.revokeObjectURL(videoDownloadUrl);
      videoDownloadUrl = null;
    }

    try {
      const res = await fetch(apiUrl("/render_video"), { method: "POST", body: fd });
      if (!res.ok) {
        const detail = (await res.text()).trim().slice(0, 180);
        videoStatus.textContent = `${previewOnly ? "Video preview failed" : "Video render failed"}${detail ? ` · ${detail}` : ""}.`;
        setVideoProcess(title, [...steps.slice(0, -1), "Failed"], steps.length - 1);
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        videoStatus.textContent = previewOnly ? "Video preview returned an empty file." : "Video render returned an empty file.";
        setVideoProcess(title, [...steps.slice(0, -1), "Empty output"], steps.length - 1);
        return;
      }

      const frameCount = res.headers.get("x-video-frames");
      const encoderName = res.headers.get("x-video-encoder");
      const renderTime = res.headers.get("x-video-render-time");
      const totalTime = res.headers.get("x-video-total-time");
      setVideoProcess(title, steps, steps.length - 1);

      if (previewOnly) {
        const url = URL.createObjectURL(blob);
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        videoPreviewUrl = url;
        videoStage.innerHTML = `<video class="styledVideo" src="${url}" controls autoplay loop muted playsinline></video>`;
        videoStatus.textContent = `Preview ready${frameCount ? ` · ${frameCount} frames` : ""}${encoderName ? ` · ${encoderName}` : ""}${renderTime ? ` · render ${renderTime}s` : ""}${totalTime ? ` · total ${totalTime}s` : ""}.`;
        window.setTimeout(hideVideoProcess, 700);
        return;
      }

      const effect = safeEffect(effectName(activePreset, canvasComp.getMode()));
      const filename = `${currentVideoBaseName}-u.dither-effect:${effect}.mp4`;
      videoDownloadUrl = URL.createObjectURL(blob);
      videoDownload.href = videoDownloadUrl;
      videoDownload.download = filename;
      videoDownload.textContent = `DOWNLOAD ${filename.toUpperCase()}`;
      videoDownload.hidden = false;
      downloadBlob(blob, filename);
      videoStatus.textContent = `Download ready${frameCount ? ` · ${frameCount} frames` : ""}${encoderName ? ` · ${encoderName}` : ""}${totalTime ? ` · total ${totalTime}s` : ""}.`;
      window.setTimeout(hideVideoProcess, 900);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      videoStatus.textContent = `${previewOnly ? "Video preview failed" : "Video render failed"} · ${detail.slice(0, 180)}.`;
      setVideoProcess(title, [...steps.slice(0, -1), "Failed"], steps.length - 1);
    } finally {
      if (videoTicker) {
        window.clearInterval(videoTicker);
        videoTicker = null;
      }
      setVideoBusy(false);
    }
  }

  renderVideoBtn.onclick = () => renderVideo(false);

  applyPreset(STUDIO_PRESETS[0]);
  setWorkspace("image");
  applyTooltips(root);

  function cleanup() {
    window.removeEventListener("resize", resizeHandler);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    if (videoDownloadUrl) URL.revokeObjectURL(videoDownloadUrl);
  }

  window.addEventListener("beforeunload", cleanup, { once: true });

  return root;
}
