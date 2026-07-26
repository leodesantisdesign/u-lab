export type CustomSelectOption = {
  value: string;
  label: string;
  meta?: string;
  swatches?: string[];
  disabled?: boolean;
};

type CustomSelectConfig = {
  options: CustomSelectOption[];
  value: string;
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
};

let activeSelect: HTMLElement | null = null;
let closeActiveSelect: (() => void) | null = null;

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function swatchMarkup(colors: string[] = []) {
  if (!colors.length) return "";
  return `<span class="customSelectSwatches">${colors.slice(0, 8).map((color) => `<i style="background:${color}"></i>`).join("")}</span>`;
}

export function CustomSelect(config: CustomSelectConfig) {
  const el = document.createElement("div");
  el.className = `customSelect ${config.className ?? ""}`.trim();
  el.dataset.value = config.value;

  let options = [...config.options];
  let value = config.value;

  function currentOption() {
    return options.find((option) => option.value === value) ?? options.find((option) => !option.disabled) ?? options[0];
  }

  function close() {
    el.dataset.open = "false";
    button.setAttribute("aria-expanded", "false");
    if (activeSelect === el) {
      activeSelect = null;
      closeActiveSelect = null;
    }
  }

  function open() {
    if (activeSelect && activeSelect !== el) closeActiveSelect?.();
    activeSelect = el;
    closeActiveSelect = close;
    el.dataset.open = "true";
    button.setAttribute("aria-expanded", "true");
  }

  function renderOptions() {
    list.innerHTML = options
      .map((option) => {
        const selected = option.value === value;
        return `
          <button
            class="customSelectOption"
            type="button"
            role="option"
            data-value="${option.value}"
            aria-selected="${selected}"
            data-tip="${escapeAttr(option.meta ? option.meta : `Select ${option.label}`)}"
            ${option.disabled ? "disabled" : ""}
          >
            ${swatchMarkup(option.swatches)}
            <span class="customSelectText">
              <strong>${escapeText(option.label)}</strong>
              ${option.meta ? `<small>${escapeText(option.meta)}</small>` : ""}
            </span>
          </button>
        `;
      })
      .join("");

    list.querySelectorAll<HTMLButtonElement>(".customSelectOption").forEach((optionButton) => {
      optionButton.onclick = () => {
        if (optionButton.disabled) return;
        setValue(optionButton.dataset.value ?? value, true);
        close();
      };
    });
  }

  function renderButton() {
    const option = currentOption();
    el.dataset.swatches = option?.swatches?.length ? "true" : "false";
    button.innerHTML = `
      ${swatchMarkup(option?.swatches)}
      <span class="customSelectText">
        <strong>${escapeText(option?.label ?? value)}</strong>
        ${option?.meta ? `<small>${escapeText(option.meta)}</small>` : ""}
      </span>
      <span class="customSelectArrow" aria-hidden="true"></span>
    `;
    el.dataset.value = value;
  }

  function setValue(next: string, notify = false) {
    const option = options.find((item) => item.value === next && !item.disabled);
    if (!option) return;
    value = option.value;
    renderButton();
    renderOptions();
    if (notify) config.onChange(value);
  }

  function setOptions(next: CustomSelectOption[], nextValue = value) {
    options = [...next];
    const fallback = options.find((option) => option.value === nextValue && !option.disabled) ?? options.find((option) => !option.disabled);
    value = fallback?.value ?? nextValue;
    renderButton();
    renderOptions();
  }

  el.innerHTML = `
    <button class="customSelectButton" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${config.ariaLabel}"></button>
    <div class="customSelectMenu" role="listbox" aria-label="${config.ariaLabel}"></div>
  `;

  const button = el.querySelector<HTMLButtonElement>(".customSelectButton")!;
  const list = el.querySelector<HTMLDivElement>(".customSelectMenu")!;
  button.dataset.tip = `Choose ${config.ariaLabel.toLowerCase()}.`;

  button.onclick = () => {
    if (el.dataset.open === "true") close();
    else open();
  };

  button.onkeydown = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (el.dataset.open === "true") close();
      else open();
    }
  };

  document.addEventListener("pointerdown", (event) => {
    if (!el.contains(event.target as Node)) close();
  });

  renderButton();
  renderOptions();
  close();

  return {
    el,
    getValue: () => value,
    setValue: (next: string) => setValue(next, false),
    setOptions,
  };
}
