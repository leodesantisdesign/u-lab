import {
  DEFAULT_EFFECT_ORDER,
  EFFECT_META,
  FX_DEFAULTS,
  createEffectStack,
  type EffectId,
  type EffectStackItem,
  type FxParams,
  sanitizeFx,
} from "../core/fxParams";
import { applyTooltips } from "../core/tooltips";
import { CustomSelect } from "./CustomSelect";

const AVAILABLE_EFFECTS = Object.keys(EFFECT_META) as EffectId[];

export function ControlsFx(onChange: (p: FxParams) => void) {
  const el = document.createElement("div");
  el.className = "fxPanel";
  el.innerHTML = `
    <div class="stackHead">
      <div>
        <label>POST FX STACK</label>
        <div class="stackHint">ORDERED AFTER ENGINE</div>
      </div>
      <button id="addEffect" type="button">ADD SLOT</button>
    </div>
    <div id="stackList" class="stackList" aria-label="Effect stack"></div>
    <div class="stackAdd" id="stackAdd" hidden></div>
  `;

  const list = el.querySelector<HTMLDivElement>("#stackList")!;
  const addPanel = el.querySelector<HTMLDivElement>("#stackAdd")!;
  const addEffect = el.querySelector<HTMLButtonElement>("#addEffect")!;

  let current: FxParams = sanitizeFx({
    ...FX_DEFAULTS,
    stack: createEffectStack(
      { acidGlow: 72, noise: 24, scanlines: 18, sharpen: 18, grain: 12, vignette: 28 },
      { acidGlow: true, noise: true, scanlines: true, sharpen: true, grain: true, vignette: true },
      DEFAULT_EFFECT_ORDER
    ),
  });

  function updateStack(next: EffectStackItem[]) {
    current = sanitizeFx({ ...current, stack: next });
    onChange(current);
    renderStack();
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...current.stack];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateStack(next);
  }

  function remove(index: number) {
    updateStack(current.stack.filter((_, itemIndex) => itemIndex !== index));
  }

  function renderStack() {
    list.innerHTML = "";
    if (!current.stack.length) {
      list.innerHTML = `<div class="emptyStack">No post effect. Add FX to build a look.</div>`;
      return;
    }

    current.stack.forEach((item, index) => {
      const meta = EFFECT_META[item.id];
      const row = document.createElement("article");
      row.className = "stackCard";
      row.dataset.enabled = String(item.enabled);
      row.dataset.tip = meta.tip;
      row.innerHTML = `
        <div class="stackCardTop">
          <label class="stackToggle">
            <input type="checkbox" ${item.enabled ? "checked" : ""} aria-label="Enable ${meta.label}" />
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${meta.label}</strong>
          </label>
          <div class="stackMove">
            <button type="button" data-action="up" aria-label="Move ${meta.label} up">↑</button>
            <button type="button" data-action="down" aria-label="Move ${meta.label} down">↓</button>
            <button type="button" data-action="remove" aria-label="Remove ${meta.label}">×</button>
          </div>
        </div>
        <div class="stackAmount">
          <input type="range" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${item.amount}" aria-label="${meta.label} amount" />
          <div class="pillVal">${Math.round(item.amount)}</div>
        </div>
      `;

      row.querySelector<HTMLInputElement>('input[type="checkbox"]')!.onchange = (event) => {
        const target = event.currentTarget as HTMLInputElement;
        updateStack(current.stack.map((fx, itemIndex) => (itemIndex === index ? { ...fx, enabled: target.checked } : fx)));
      };
      row.querySelector<HTMLInputElement>('input[type="range"]')!.oninput = (event) => {
        const target = event.currentTarget as HTMLInputElement;
        updateStack(current.stack.map((fx, itemIndex) => (itemIndex === index ? { ...fx, amount: Number(target.value) } : fx)));
      };
      row.querySelector<HTMLButtonElement>('[data-action="up"]')!.onclick = () => move(index, -1);
      row.querySelector<HTMLButtonElement>('[data-action="down"]')!.onclick = () => move(index, 1);
      row.querySelector<HTMLButtonElement>('[data-action="remove"]')!.onclick = () => remove(index);
      list.appendChild(row);
    });
    applyTooltips(el);
  }

  function renderAddPanel() {
    const used = new Set(current.stack.map((item) => item.id));
    const choices = AVAILABLE_EFFECTS.filter((id) => !used.has(id));
    addPanel.innerHTML = `
      <label>
        <span>CHOOSE FX</span>
        <div id="chooseFx"></div>
      </label>
      <button type="button" id="confirmFx" ${choices.length ? "" : "disabled"}>ADD</button>
    `;
    const chooseHost = addPanel.querySelector<HTMLDivElement>("#chooseFx")!;
    const choose = CustomSelect({
      ariaLabel: "Choose FX",
      value: choices[0] ?? "",
      options: choices.length
        ? choices.map((id) => ({ value: id, label: EFFECT_META[id].label, meta: EFFECT_META[id].tip }))
        : [{ value: "", label: "No FX available", disabled: true }],
      onChange: () => undefined,
    });
    chooseHost.appendChild(choose.el);
    addPanel.querySelector<HTMLButtonElement>("#confirmFx")!.onclick = () => {
      if (!choose.getValue()) return;
      const id = choose.getValue() as EffectId;
      const meta = EFFECT_META[id];
      updateStack([...current.stack, { id, enabled: true, amount: meta.defaultAmount }]);
      addPanel.hidden = true;
    };
    applyTooltips(addPanel);
  }

  addEffect.onclick = () => {
    renderAddPanel();
    addPanel.hidden = !addPanel.hidden;
  };

  function updateExternal(next: Partial<FxParams>) {
    current = sanitizeFx({ ...current, ...next });
    renderStack();
    onChange(current);
  }

  renderStack();
  onChange(current);
  return { el, getCurrent: () => current, updateExternal };
}
