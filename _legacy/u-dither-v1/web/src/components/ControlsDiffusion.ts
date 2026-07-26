import { type DiffusionAlgorithm, type DiffusionParams, sanitizeDiffusion } from "../core/diffusionParams";
import { DEFAULT_PARAMS } from "../core/modes";

export function ControlsDiffusion(algorithm: DiffusionAlgorithm, onChange: (p: DiffusionParams) => void) {
  const defaults = DEFAULT_PARAMS[algorithm];
  const title = algorithm === "atkinson" ? "ATKINSON / SOFT DIFFUSION" : "FLOYD-STEINBERG / ERROR DIFFUSION";
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="ctrl">
      <label>${title}</label>
      <div class="pillVal">DIFFUSE</div>
    </div>

    <div class="ctrl">
      <label>LEVELS</label>
      <div class="row">
        <input id="levels" type="range" min="2" max="8" step="1" value="${defaults.levels}"/>
        <div id="levelsVal" class="pillVal">${defaults.levels}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>BRIGHTNESS</label>
      <div class="row">
        <input id="brightness" type="range" min="-50" max="50" step="1" value="${defaults.brightness}"/>
        <div id="brightnessVal" class="pillVal">${defaults.brightness}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>CONTRAST</label>
      <div class="row">
        <input id="contrast" type="range" min="-50" max="50" step="1" value="${defaults.contrast}"/>
        <div id="contrastVal" class="pillVal">${defaults.contrast}</div>
      </div>
    </div>

    <div class="ctrl">
      <label>GAMMA</label>
      <div class="row">
        <input id="gamma" type="range" min="0.4" max="3.0" step="0.05" value="${defaults.gamma}"/>
        <div id="gammaVal" class="pillVal">${defaults.gamma.toFixed(2)}</div>
      </div>
    </div>

    <div class="ctrl splitCtrl">
      <label>SERPENTINE</label>
      <label class="switch">
        <input id="serpentine" type="checkbox" ${defaults.serpentine ? "checked" : ""}>
        <span class="slider"></span>
      </label>
    </div>

  `;

  const levels = el.querySelector<HTMLInputElement>("#levels")!;
  const brightness = el.querySelector<HTMLInputElement>("#brightness")!;
  const contrast = el.querySelector<HTMLInputElement>("#contrast")!;
  const gamma = el.querySelector<HTMLInputElement>("#gamma")!;
  const serpentine = el.querySelector<HTMLInputElement>("#serpentine")!;

  const levelsVal = el.querySelector<HTMLDivElement>("#levelsVal")!;
  const brightnessVal = el.querySelector<HTMLDivElement>("#brightnessVal")!;
  const contrastVal = el.querySelector<HTMLDivElement>("#contrastVal")!;
  const gammaVal = el.querySelector<HTMLDivElement>("#gammaVal")!;

  let current: DiffusionParams = defaults;

  function emit() {
    current = sanitizeDiffusion(
      {
        levels: parseInt(levels.value, 10),
        brightness: parseInt(brightness.value, 10),
        colorMode: current.colorMode,
        palette: current.palette,
        contrast: parseInt(contrast.value, 10),
        gamma: parseFloat(gamma.value),
        serpentine: serpentine.checked,
        invert: false,
      },
      algorithm
    );

    levelsVal.textContent = String(current.levels);
    brightnessVal.textContent = String(current.brightness);
    contrastVal.textContent = String(current.contrast);
    gammaVal.textContent = current.gamma.toFixed(2);
    onChange(current);
  }

  levels.oninput = emit;
  brightness.oninput = emit;
  contrast.oninput = emit;
  gamma.oninput = emit;
  serpentine.onchange = emit;

  emit();

  function updateExternal(next: Partial<DiffusionParams>) {
    current = sanitizeDiffusion({ ...current, ...next }, algorithm);
    levels.value = String(current.levels);
    brightness.value = String(current.brightness);
    contrast.value = String(current.contrast);
    gamma.value = String(current.gamma);
    serpentine.checked = current.serpentine;
    emit();
  }

  return { el, getCurrent: () => current, updateExternal };
}
