<script lang="ts">
  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
  }

  let {
    label,
    value = $bindable(),
    min = 0,
    max = 100,
    step = 1,
    unit = '',
    disabled = false,
  }: Props = $props();

  const percent = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider-row">
  <div class="slider-row__head">
    <span class="slider-row__label">{label}</span>
    <span class="slider-row__value">{value}{unit}</span>
  </div>
  <input
    class="slider-row__input"
    type="range"
    aria-label={label}
    {min}
    {max}
    {step}
    {disabled}
    bind:value
    style:--fill="{percent}%"
  />
</div>

<style>
  .slider-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .slider-row__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-8);
  }

  .slider-row__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .slider-row__value {
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    font-weight: 400;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .slider-row__input {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    /* Boîte = cible tactile 44px ; le pouce visuel reste 14px, centré dedans */
    height: var(--tap-target-min);
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .slider-row__input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* Piste : dégradé --ink jusqu'au pouce, --line ensuite, pour un remplissage sans accent */
  .slider-row__input::-webkit-slider-runnable-track {
    height: var(--track-height);
    border-radius: var(--r-sm);
    background: linear-gradient(
      to right,
      var(--ink) var(--fill),
      var(--line) var(--fill)
    );
  }

  .slider-row__input::-moz-range-track {
    height: var(--track-height);
    border-radius: var(--r-sm);
    background: var(--line);
  }

  .slider-row__input::-moz-range-progress {
    height: var(--track-height);
    border-radius: var(--r-sm);
    background: var(--ink);
  }

  .slider-row__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb-size);
    height: var(--thumb-size);
    border-radius: 50%;
    background: var(--ink);
    margin-top: calc((var(--track-height) - var(--thumb-size)) / 2);
    transition: transform var(--dur-fast) var(--ease);
  }

  .slider-row__input::-moz-range-thumb {
    width: var(--thumb-size);
    height: var(--thumb-size);
    border: none;
    border-radius: 50%;
    background: var(--ink);
    transition: transform var(--dur-fast) var(--ease);
  }

  .slider-row__input:hover::-webkit-slider-thumb,
  .slider-row__input:focus-visible::-webkit-slider-thumb {
    transform: scale(1.15);
  }

  .slider-row__input:hover::-moz-range-thumb,
  .slider-row__input:focus-visible::-moz-range-thumb {
    transform: scale(1.15);
  }

  .slider-row__input:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--space-4);
  }
</style>
