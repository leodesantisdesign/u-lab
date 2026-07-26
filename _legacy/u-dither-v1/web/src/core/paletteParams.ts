export type PaletteName =
  | "none"
  | "gameboy"
  | "cga"
  | "macintosh"
  | "pico8"
  | "warm_print"
  | "cold_signal"
  | "xerox_heat"
  | "acid_orange"
  | "custom";

export const PALETTE_OPTIONS: { value: PaletteName; label: string; swatches: string[] }[] = [
  { value: "none", label: "No palette", swatches: [] },
  { value: "gameboy", label: "Game Boy", swatches: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { value: "cga", label: "CGA", swatches: ["#000000", "#55ffff", "#ff55ff", "#ffffff"] },
  { value: "macintosh", label: "Macintosh 1-bit", swatches: ["#000000", "#ffffff"] },
  {
    value: "pico8",
    label: "PICO-8",
    swatches: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ff004d", "#ffa300", "#ffec27", "#29adff"],
  },
  { value: "warm_print", label: "Warm Print", swatches: ["#15110f", "#6b3428", "#c06c3e", "#e7b65a", "#f6e6c8"] },
  { value: "cold_signal", label: "Cold Signal", swatches: ["#061820", "#123a4a", "#1d6f82", "#5bd7c7", "#f2fff8"] },
  { value: "xerox_heat", label: "Xerox Heat", swatches: ["#050201", "#250401", "#7a0900", "#d81f00", "#ff6606", "#ffd15a", "#f4eee1"] },
  {
    value: "acid_orange",
    label: "Acid Orange",
    swatches: ["#070000", "#220100", "#5b0300", "#c11200", "#ff2b00", "#ff6606", "#ffd000", "#fff6c9"],
  },
  { value: "custom", label: "Custom", swatches: [] },
];

export const DEFAULT_CUSTOM_PALETTE = ["#050201", "#4a0b03", "#ff2600", "#ff6606", "#ffd000", "#fff0b8"];

const PALETTE_VALUES = PALETTE_OPTIONS.map((option) => option.value);

export function sanitizePalette(raw: unknown): PaletteName {
  return PALETTE_VALUES.includes(raw as PaletteName) ? (raw as PaletteName) : "none";
}
