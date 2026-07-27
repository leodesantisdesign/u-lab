<script lang="ts">
  interface Props {
    label: string;
    value: string;
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();
</script>

<div class="color-field" class:color-field--disabled={disabled}>
  <span class="color-field__label">{label}</span>
  <span class="color-field__control">
    <span class="color-field__swatch" style:background={value}></span>
    <span class="color-field__value">{value}</span>
    <input
      class="color-field__input"
      type="color"
      aria-label={label}
      {disabled}
      bind:value
    />
  </span>
</div>

<style>
  .color-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
    width: 100%;
  }

  .color-field--disabled {
    opacity: 0.5;
  }

  .color-field__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .color-field__control {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-8);
    border-radius: var(--r-sm);
    cursor: pointer;
  }

  .color-field--disabled .color-field__control {
    cursor: not-allowed;
  }

  .color-field__control:focus-within {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .color-field__swatch {
    width: var(--space-20);
    height: var(--space-20);
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    flex-shrink: 0;
  }

  .color-field__value {
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
  }

  .color-field__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .color-field--disabled .color-field__input {
    cursor: not-allowed;
  }
</style>
