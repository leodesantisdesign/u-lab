import { HALFTONE_DEFAULTS, type HalftoneParams, sanitizeHalftone } from "../core/halftoneParams";

export function ControlsHalftone(onChange: (p: HalftoneParams) => void) {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="ctrl">
      <label>HALFTONE / DOT SCREEN</label>
      <div class="pillVal">ROUND</div>
    </div>

    <div class="ctrl">
      <label>CELL SIZE</label>
      <div class="row">
        <input id="cell" type="range" min="4" max="64" step="1" value="${HALFTONE_DEFAULTS.cellSize}"/>
        <div id="cellVal" class="pillVal">${HALFTONE_DEFAULTS.cellSize}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>DOT SIZE</label>
      <div class="row">
        <input id="dot" type="range" min="20" max="130" step="1" value="${HALFTONE_DEFAULTS.dotSize}"/>
        <div id="dotVal" class="pillVal">${HALFTONE_DEFAULTS.dotSize}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>MIN DOT</label>
      <div class="row">
        <input id="min" type="range" min="0" max="40" step="1" value="${HALFTONE_DEFAULTS.minDot}"/>
        <div id="minVal" class="pillVal">${String(HALFTONE_DEFAULTS.minDot).padStart(2, "0")}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>GAMMA</label>
      <div class="row">
        <input id="gamma" type="range" min="0.4" max="3.0" step="0.05" value="${HALFTONE_DEFAULTS.gamma}"/>
        <div id="gammaVal" class="pillVal">${HALFTONE_DEFAULTS.gamma.toFixed(2)}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>CONTRAST</label>
      <div class="row">
        <input id="contrast" type="range" min="-50" max="50" step="1" value="${HALFTONE_DEFAULTS.contrast}"/>
        <div id="contrastVal" class="pillVal">${HALFTONE_DEFAULTS.contrast}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>JITTER</label>
      <div class="row">
        <input id="jit" type="range" min="0" max="80" step="1" value="${HALFTONE_DEFAULTS.jitter}"/>
        <div id="jitVal" class="pillVal">${String(HALFTONE_DEFAULTS.jitter).padStart(2, "0")}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>STRETCH</label>
      <div class="row">
        <input id="stretch" type="range" min="60" max="160" step="1" value="${HALFTONE_DEFAULTS.stretch}"/>
        <div id="stretchVal" class="pillVal">${HALFTONE_DEFAULTS.stretch}</div>
      </div>
    </div>
  `;

  const cell = el.querySelector<HTMLInputElement>("#cell")!;
  const dot = el.querySelector<HTMLInputElement>("#dot")!;
  const min = el.querySelector<HTMLInputElement>("#min")!;
  const gamma = el.querySelector<HTMLInputElement>("#gamma")!;
  const contrast = el.querySelector<HTMLInputElement>("#contrast")!;
  const jit = el.querySelector<HTMLInputElement>("#jit")!;
  const stretch = el.querySelector<HTMLInputElement>("#stretch")!;

  const cellVal = el.querySelector<HTMLDivElement>("#cellVal")!;
  const dotVal = el.querySelector<HTMLDivElement>("#dotVal")!;
  const minVal = el.querySelector<HTMLDivElement>("#minVal")!;
  const gammaVal = el.querySelector<HTMLDivElement>("#gammaVal")!;
  const contrastVal = el.querySelector<HTMLDivElement>("#contrastVal")!;
  const jitVal = el.querySelector<HTMLDivElement>("#jitVal")!;
  const stretchVal = el.querySelector<HTMLDivElement>("#stretchVal")!;

  let current: HalftoneParams = HALFTONE_DEFAULTS;

  function emit() {
    current = sanitizeHalftone({
      cellSize: parseInt(cell.value, 10),
      dotSize: parseInt(dot.value, 10),
      minDot: parseInt(min.value, 10),
      gamma: parseFloat(gamma.value),
      contrast: parseInt(contrast.value, 10),
      shape: "circle",
      colorMode: current.colorMode,
      roundness: 100,
      jitter: parseInt(jit.value, 10),
      stretch: parseInt(stretch.value, 10),
      invert: false,
      palette: current.palette,
    });

    cellVal.textContent = String(current.cellSize);
    dotVal.textContent = String(current.dotSize);
    minVal.textContent = String(current.minDot).padStart(2, "0");
    gammaVal.textContent = current.gamma.toFixed(2);
    contrastVal.textContent = String(current.contrast);
    jitVal.textContent = String(current.jitter).padStart(2, "0");
    stretchVal.textContent = String(current.stretch);

    onChange(current);
  }

  cell.oninput = emit;
  dot.oninput = emit;
  min.oninput = emit;
  gamma.oninput = emit;
  contrast.oninput = emit;
  jit.oninput = emit;
  stretch.oninput = emit;

  emit();

  function updateExternal(next: Partial<HalftoneParams>) {
    current = sanitizeHalftone({ ...current, ...next });
    cell.value = String(current.cellSize);
    dot.value = String(current.dotSize);
    min.value = String(current.minDot);
    gamma.value = String(current.gamma);
    contrast.value = String(current.contrast);
    jit.value = String(current.jitter);
    stretch.value = String(current.stretch);
    emit();
  }

  return { el, getCurrent: () => current, updateExternal };
}
