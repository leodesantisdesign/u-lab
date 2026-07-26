import { DEFAULT_CUSTOM_PALETTE } from "../core/paletteParams";
import { applyTooltips } from "../core/tooltips";

const QUICK_COLORS = [
  "#050201",
  "#111111",
  "#f2f2ee",
  "#ffffff",
  "#ff2600",
  "#ff6606",
  "#ff8a00",
  "#ffd000",
  "#fff0b8",
  "#0f380f",
  "#306230",
  "#8bac0f",
  "#9bbc0f",
  "#000000",
  "#1d2b53",
  "#7e2553",
  "#008751",
  "#ff004d",
  "#ffa300",
  "#29adff",
  "#f6e6c8",
  "#6b3428",
  "#d81f00",
  "#f4eee1",
];

const HEX_RE = /^#[0-9A-F]{6}$/;

function normalizeHex(value: string) {
  const raw = value.trim().replace(/^#/, "").toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 6);
  return `#${raw}`;
}

function isHex(value: string) {
  return HEX_RE.test(value);
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const clean = isHex(hex) ? hex : "#FF6606";
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function readableText(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.58 ? "#050505" : "#f2f2ee";
}

export function CustomPaletteEditor(onChange: (colors: string[]) => void) {
  const el = document.createElement("div");
  el.className = "customPalette";

  let colors = [...DEFAULT_CUSTOM_PALETTE].map((color) => normalizeHex(color)).filter(isHex);
  let activeIndex = 0;
  let editorOpen = false;

  function emit() {
    onChange([...colors]);
  }

  function applyChipStyles() {
    el.querySelectorAll<HTMLElement>("[data-chip-color]").forEach((node) => {
      const color = node.dataset.chipColor ?? "#000000";
      node.style.setProperty("--chip", color);
      node.style.setProperty("--chipText", readableText(color));
    });
  }

  function openEditor(index: number) {
    activeIndex = Math.max(0, Math.min(colors.length - 1, index));
    editorOpen = true;
    render();
  }

  function closeEditor() {
    editorOpen = false;
    render();
  }

  function setColor(index: number, color: string, rerender = true) {
    const normalized = normalizeHex(color);
    if (!isHex(normalized)) return;
    colors[index] = normalized;
    emit();
    if (rerender) render();
    else refreshColorUi();
  }

  function refreshColorUi() {
    const activeColor = colors[activeIndex] ?? "#FF6606";
    const rgb = hexToRgb(activeColor);
    el.querySelectorAll<HTMLElement>(".colorRow").forEach((row, idx) => {
      const color = colors[idx] ?? "#FF6606";
      row.classList.toggle("active", idx === activeIndex);
      row.querySelectorAll<HTMLElement>("[data-chip-color]").forEach((node) => {
        node.dataset.chipColor = color;
      });
      const readout = row.querySelector<HTMLElement>(".colorHexReadout strong");
      const state = row.querySelector<HTMLElement>(".colorHexReadout small");
      if (readout) readout.textContent = color;
      if (state) state.textContent = idx === activeIndex ? "editing" : "select";
    });
    const preview = el.querySelector<HTMLElement>(".colorPreviewLarge");
    if (preview) preview.dataset.chipColor = activeColor;
    const activeLabel = el.querySelector<HTMLElement>(".colorLabHead small");
    if (activeLabel) activeLabel.textContent = activeColor;
    const activeHex = el.querySelector<HTMLInputElement>("#activeHex");
    if (activeHex && document.activeElement !== activeHex) activeHex.value = activeColor;
    el.querySelectorAll<HTMLInputElement>("[data-rgb]").forEach((input) => {
      const channel = input.dataset.rgb as "r" | "g" | "b";
      input.value = String(rgb[channel]);
      const value = input.closest(".rgbControl")?.querySelector<HTMLElement>("strong");
      if (value) value.textContent = String(rgb[channel]);
    });
    applyChipStyles();
  }

  function render() {
    const activeColor = colors[activeIndex] ?? colors[0] ?? "#FF6606";
    const rgb = hexToRgb(activeColor);
    const quickColors = [...new Set([...colors, ...QUICK_COLORS])].slice(0, 32);

    el.innerHTML = `
      <div class="paletteStrip" aria-label="Palette colors">
        ${colors
          .map(
            (color, idx) => `
              <div class="colorRow ${idx === activeIndex ? "active" : ""}">
                <button class="colorSwatchButton" type="button" data-edit="${idx}" data-chip-color="${color}" aria-label="Edit ${color}">
                  <span></span>
                </button>
                <button class="colorHexReadout" type="button" data-edit="${idx}" aria-label="Edit ${color}">
                  <strong>${color}</strong>
                  <small>${idx === activeIndex ? "editing" : "select"}</small>
                </button>
                <button class="removeColorButton" type="button" data-remove="${idx}" aria-label="Remove ${color}">×</button>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="miniActions">
        <button type="button" id="addColor">ADD COLOR</button>
      </div>

      <div class="colorPopup" ${editorOpen ? "" : "hidden"}>
        <button class="colorPopupBackdrop" type="button" data-close-color aria-label="Close color editor"></button>
        <div class="colorPopupPanel" role="dialog" aria-modal="true" aria-label="Edit palette color">
          <div class="colorPopupHead">
            <div>
              <span>PALETTE EDITOR</span>
              <strong>COLOR ${String(activeIndex + 1).padStart(2, "0")}</strong>
            </div>
            <button class="popupClose" type="button" data-close-color aria-label="Close color editor">×</button>
          </div>
          <div class="colorLab">
            <div class="colorLabHead">
              <span class="colorPreviewLarge" data-chip-color="${activeColor}"></span>
              <div>
                <strong>ACTIVE HEX</strong>
                <small>${activeColor}</small>
              </div>
            </div>
            <label class="hexField">
              <span>HEX</span>
              <input id="activeHex" value="${activeColor}" maxlength="7" inputmode="text" spellcheck="false" aria-label="Active hex color" />
            </label>
            <div class="rgbMixer">
              ${(["r", "g", "b"] as const)
                .map(
                  (channel) => `
                    <label class="rgbControl">
                      <span>${channel.toUpperCase()}</span>
                      <input data-rgb="${channel}" type="range" min="0" max="255" step="1" value="${rgb[channel]}" />
                      <strong>${rgb[channel]}</strong>
                    </label>
                  `
                )
                .join("")}
            </div>
            <div class="quickColorGrid">
              ${quickColors
                .map((color) => `<button class="quickColorButton" type="button" data-quick="${color}" data-chip-color="${color}" aria-label="Use ${color}"></button>`)
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    applyChipStyles();

    el.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) => {
      btn.onclick = () => openEditor(Number(btn.dataset.edit));
    });

    el.querySelectorAll<HTMLButtonElement>("[data-close-color]").forEach((btn) => {
      btn.onclick = closeEditor;
    });

    const activeHex = el.querySelector<HTMLInputElement>("#activeHex");
    if (activeHex) {
      activeHex.oninput = () => {
        const normalized = normalizeHex(activeHex.value);
        activeHex.value = normalized;
        activeHex.classList.toggle("invalid", !isHex(normalized));
        if (isHex(normalized)) setColor(activeIndex, normalized, false);
      };
      activeHex.onblur = () => {
        if (!isHex(normalizeHex(activeHex.value))) render();
      };
      activeHex.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setColor(activeIndex, activeHex.value, true);
        } else if (event.key === "Escape") {
          closeEditor();
        }
      };
    }

    el.querySelectorAll<HTMLInputElement>("[data-rgb]").forEach((input) => {
      input.oninput = () => {
        const current = hexToRgb(colors[activeIndex] ?? activeColor);
        const next = {
          ...current,
          [input.dataset.rgb ?? "r"]: Number(input.value),
        };
        setColor(activeIndex, rgbToHex(next.r, next.g, next.b), false);
      };
    });

    el.querySelectorAll<HTMLButtonElement>("[data-quick]").forEach((btn) => {
      btn.onclick = () => setColor(activeIndex, btn.dataset.quick ?? activeColor, false);
    });

    el.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
      btn.onclick = () => {
        if (colors.length <= 2) return;
        colors.splice(Number(btn.dataset.remove), 1);
        activeIndex = Math.min(activeIndex, colors.length - 1);
        emit();
        render();
      };
    });

    el.querySelector<HTMLButtonElement>("#addColor")!.onclick = () => {
      if (colors.length >= 16) return;
      colors.push("#FF6606");
      activeIndex = colors.length - 1;
      editorOpen = true;
      emit();
      render();
    };

    applyTooltips(el);
  }

  function setColors(next: string[]) {
    const clean = next.map((color) => normalizeHex(color)).filter(isHex).slice(0, 16);
    colors = clean.length ? clean : [...DEFAULT_CUSTOM_PALETTE].map((color) => normalizeHex(color));
    activeIndex = Math.min(activeIndex, colors.length - 1);
    emit();
    render();
  }

  render();
  emit();

  return { el, setColors, getColors: () => [...colors] };
}
