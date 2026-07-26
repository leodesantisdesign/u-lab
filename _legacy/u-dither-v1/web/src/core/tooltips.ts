const TIPS: Record<string, string> = {
  UPLOAD: "Load a source image for the live preview and still exports.",
  "UPLOAD VIDEO": "Select a video file to process with the current look.",
  "ADD COLOR": "Add one editable color to the current custom palette.",
  HALFTONE: "Dot-screen engine. Strong for posters and still images, heavier and less stable for video.",
  BAYER: "Ordered dither engine. Fast, crisp and recommended for video.",
  FLOYD: "Floyd-Steinberg error diffusion. Detailed, organic and slower on video.",
  ATKINSON: "Soft error diffusion with vintage texture. Good for graphic video looks.",
  "EXPORT IMAGE": "Export the current still render as PNG or JPG at the selected scale.",
  "RENDER VIDEO": "Render the uploaded video with the current engine, palette and FX stack.",
  "ADD SLOT": "Add one effect slot to the ordered post-FX stack.",
  FIT: "Reset pan and zoom to fit the image inside the viewport.",
  "100%": "Zoom to native image pixels.",
  "+": "Zoom in on the preview.",
  "-": "Zoom out of the preview.",
  ORIGINAL: "Show only the source image.",
  OUTPUT: "Show only the processed result.",
  SPLIT: "Compare source and result side by side.",
};

const LABEL_TIPS: Record<string, string> = {
  SOURCE: "Image input used by preview, palette extraction and still export.",
  LOOK: "Complete style presets. Acid Orange is the signature default, but palette presets stay editable.",
  VIDEO: "Video export uses the current look. Bayer and Atkinson are the most reliable engines.",
  PALETTE: "Select a known palette or edit a custom extracted palette.",
  ENGINE: "Choose the core image algorithm before palettes and post FX are applied.",
  PARAMETERS: "Focused controls for the selected dithering engine.",
  "FX STACK": "Global post effects applied after the engine: glow, grain, scanlines and more.",
  "POST FX STACK": "Ordered post effects. Toggle, reorder or remove blocks to build a custom look.",
  FPS: "Frames per second for video export. 24 is cinema/web standard, 25 is useful for PAL-style video.",
  WIDTH: "Maximum video width. 1080 is the best default, 1920 gives Full HD on 16:9 sources.",
  SECONDS: "Maximum duration processed from the uploaded clip. Longer exports scale almost linearly.",
  ENCODER: "AUTO uses hardware H.264 on Mac when available, with a software fallback.",
  QUALITY: "Controls video bitrate and encoder profile. QUALITY is the best default; ARCHIVE is slower and heavier.",
  "KEEP AUDIO": "Copy the original audio track into the rendered MP4 when available.",
  "HALFTONE / DOT SCREEN": "Classic print-style halftone engine based on tonal dot size.",
  "BAYER / ORDERED DITHER": "Ordered pixel dither engine. Fast, stable and best for Acid Orange video.",
  "FLOYD-STEINBERG / ERROR DIFFUSION": "Detailed error diffusion with organic grain and high edge detail.",
  "ATKINSON / SOFT DIFFUSION": "Softer error diffusion with vintage poster texture.",
  "POST BLUR": "Softens the ordered dither after the Bayer pattern is applied.",
  "CELL SIZE": "Controls the size of each halftone cell.",
  "DOT SIZE": "Controls maximum dot size in the halftone engine.",
  "MIN DOT": "Removes very small dots below this threshold.",
  GAMMA: "Changes tonal curve before dithering.",
  CONTRAST: "Pushes midtones apart before the engine processes the image.",
  SHAPE: "Chooses the halftone dot shape.",
  COLOR: "Chooses monochrome, source-color or RGB-channel processing.",
  LEVELS: "Number of tonal/color steps used by the dither.",
  MATRIX: "Pattern matrix used by ordered dithering.",
  SCALE: "Pattern scale. Higher values make larger dither cells.",
  BRIGHTNESS: "Shifts image luminance before dithering.",
  SERPENTINE: "Alternates diffusion direction each row for fewer directional artifacts.",
  INVERT: "Inverts the mode's tonal mapping.",
  NOISE: "Adds grain after the render.",
  SCANLINES: "Darkens alternating rows for CRT/print texture.",
  "ACID GLOW": "Adds hot orange/yellow bloom around bright areas.",
  SHARPEN: "Boosts edges after the dither pass.",
  GRAIN: "Adds rough monochrome film grain after the look.",
  "CHROMATIC SHIFT": "Offsets red and blue channels in opposite directions.",
  VIGNETTE: "Darkens edges and concentrates attention in the center.",
  POSTERIZE: "Reduces tonal precision after rendering.",
  ROUNDNESS: "Controls how rounded halftone shapes become.",
  JITTER: "Adds random variation to dot placement.",
  STRETCH: "Stretches halftone cells for a pulled print texture.",
  ASCII: "Turns tonal blocks into glyph-like pixel marks.",
  "CHOOSE FX": "Choose which effect should be added to the stack.",
};

export function applyTooltips(root: ParentNode = document) {
  const tooltip = ensureTooltip();

  root.querySelectorAll<HTMLElement>("button").forEach((el) => {
    const key = (el.textContent || "").trim();
    if (!el.dataset.tip && TIPS[key]) el.dataset.tip = TIPS[key];
  });

  root.querySelectorAll<HTMLElement>("label, .sectionHead label").forEach((el) => {
    const key = (el.textContent || "").trim().replace(/\s+/g, " ");
    const match = Object.keys(LABEL_TIPS).find((item) => key === item || key.startsWith(`${item} `));
    if (!el.dataset.tip && match) el.dataset.tip = LABEL_TIPS[match];
  });

  root.querySelectorAll<HTMLElement>("label.switch").forEach((el) => {
    const key = (el.previousElementSibling?.textContent || "").trim().replace(/\s+/g, " ");
    if (!el.dataset.tip) el.dataset.tip = LABEL_TIPS[key] || "Toggle this setting on or off.";
  });

  root.querySelectorAll<HTMLElement>("[data-tip]").forEach((el) => {
    if (el.dataset.tip && !el.getAttribute("aria-description")) {
      el.setAttribute("aria-description", el.dataset.tip);
    }
    if (el.dataset.tipBound === "true") return;
    el.dataset.tipBound = "true";
    el.addEventListener("pointerenter", () => showTooltip(el, tooltip));
    el.addEventListener("pointerleave", () => hideTooltip(tooltip));
    el.addEventListener("focus", () => showTooltip(el, tooltip));
    el.addEventListener("blur", () => hideTooltip(tooltip));
  });
}

function ensureTooltip() {
  let tooltip = document.querySelector<HTMLDivElement>(".uDitherTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "uDitherTooltip";
    tooltip.className = "uDitherTooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);
  }
  if (tooltip.dataset.globalListeners !== "true") {
    tooltip.dataset.globalListeners = "true";
    document.addEventListener("scroll", () => hideTooltip(tooltip), true);
    document.addEventListener("wheel", () => hideTooltip(tooltip), { capture: true, passive: true });
    document.addEventListener("touchmove", () => hideTooltip(tooltip), { capture: true, passive: true });
    document.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Tab", "Escape"].includes(event.key)) {
        hideTooltip(tooltip);
      }
    });
    window.addEventListener("resize", () => hideTooltip(tooltip));
  }
  return tooltip;
}

function showTooltip(target: HTMLElement, tooltip: HTMLDivElement) {
  const text = target.dataset.tip;
  if (!text) return;
  tooltip.textContent = text;
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.classList.add("visible");

  const rect = target.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const margin = 10;
  let left = rect.left + rect.width * 0.5 - tipRect.width * 0.5;
  left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));

  let top = rect.top - tipRect.height - 12;
  if (top < margin) top = rect.bottom + 12;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip: HTMLDivElement) {
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.classList.remove("visible");
}
