import { BAYER_DEFAULTS, type BayerParams, sanitizeBayer } from "../core/bayerParams";
import { CustomSelect } from "./CustomSelect";

export function ControlsBayer(onChange: (p: BayerParams) => void) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="ctrl">
      <label>BAYER / ORDERED DITHER</label>
      <div class="pillVal">PIXEL</div>
    </div>

    <div class="ctrl">
      <label>MATRIX</label>
      <div id="matrixSelect"></div>
    </div>

    <div class="ctrl">
      <label>SCALE</label>
      <div class="row">
        <input id="scale" type="range" min="1" max="16" step="1" value="${BAYER_DEFAULTS.scale}"/>
        <div id="scaleVal" class="pillVal">${BAYER_DEFAULTS.scale}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>LEVELS</label>
      <div class="row">
        <input id="levels" type="range" min="2" max="8" step="1" value="${BAYER_DEFAULTS.levels}"/>
        <div id="levelsVal" class="pillVal">${BAYER_DEFAULTS.levels}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>CONTRAST</label>
      <div class="row">
        <input id="contrast" type="range" min="-50" max="50" step="1" value="${BAYER_DEFAULTS.contrast}"/>
        <div id="contrastVal" class="pillVal">${BAYER_DEFAULTS.contrast}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>POST BLUR</label>
      <div class="row">
        <input id="blur" type="range" min="0" max="1" step="0.05" value="${BAYER_DEFAULTS.postBlur}"/>
        <div id="blurVal" class="pillVal">${BAYER_DEFAULTS.postBlur.toFixed(2)}</div>
      </div>
    </div>
  `;
  
  const matrixSelectHost = el.querySelector<HTMLDivElement>("#matrixSelect")!;
  const matrixSelect = CustomSelect({
    ariaLabel: "Bayer matrix",
    value: BAYER_DEFAULTS.matrix,
    options: [
      { value: "bayer2", label: "Bayer 2x2", meta: "tight grid" },
      { value: "bayer4", label: "Bayer 4x4", meta: "poster grid" },
      { value: "bayer8", label: "Bayer 8x8", meta: "smooth ordered" },
      { value: "cross", label: "Cross / Plus", meta: "symbolic dots" },
      { value: "diamond", label: "Diamond", meta: "faceted screen" },
      { value: "lines", label: "Lines / Scan", meta: "horizontal signal" },
    ],
    onChange: () => emit(),
  });
  matrixSelectHost.appendChild(matrixSelect.el);
  const scale = el.querySelector<HTMLInputElement>("#scale")!;
  const levels = el.querySelector<HTMLInputElement>("#levels")!;
  const contrast = el.querySelector<HTMLInputElement>("#contrast")!;
  const blur = el.querySelector<HTMLInputElement>("#blur")!;

  const scaleVal = el.querySelector<HTMLDivElement>("#scaleVal")!; 
  const levelsVal = el.querySelector<HTMLDivElement>("#levelsVal")!;
  const contrastVal = el.querySelector<HTMLDivElement>("#contrastVal")!;
  const blurVal = el.querySelector<HTMLDivElement>("#blurVal")!;

  let current: BayerParams = BAYER_DEFAULTS;

  function emit() {
    current = sanitizeBayer({
      matrix: matrixSelect.getValue() as BayerParams["matrix"],
      scale: parseInt(scale.value, 10),
      levels: parseInt(levels.value, 10),
      colorMode: current.colorMode,
      palette: current.palette,
      contrast: parseInt(contrast.value, 10),
      invert: false,
      postBlur: parseFloat(blur.value),
    });

    scaleVal.textContent = String(current.scale);
    levelsVal.textContent = String(current.levels);
    contrastVal.textContent = String(current.contrast);
    blurVal.textContent = current.postBlur.toFixed(2);
    onChange(current);
  }

  scale.oninput = emit;
  levels.oninput = emit;
  contrast.oninput = emit;
  blur.oninput = emit;

  emit();

  function updateExternal(next: Partial<BayerParams>) {
    current = sanitizeBayer({ ...current, ...next });
    matrixSelect.setValue(current.matrix);
    scale.value = String(current.scale);
    levels.value = String(current.levels);
    contrast.value = String(current.contrast);
    blur.value = String(current.postBlur);
    emit();
  }

  return { el, getCurrent: () => current, updateExternal };
}
