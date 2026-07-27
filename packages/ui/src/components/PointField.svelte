<script lang="ts">
  interface Props {
    label: string;
    value: { x: number; y: number };
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();
</script>

<div class="point-field">
  <span class="point-field__label">{label}</span>
  <div class="point-field__inputs">
    <label class="point-field__axis">
      <span class="point-field__axis-label">X</span>
      <input
        class="point-field__input"
        type="number"
        step="0.01"
        aria-label="{label} — X"
        {disabled}
        bind:value={value.x}
      />
    </label>
    <label class="point-field__axis">
      <span class="point-field__axis-label">Y</span>
      <input
        class="point-field__input"
        type="number"
        step="0.01"
        aria-label="{label} — Y"
        {disabled}
        bind:value={value.y}
      />
    </label>
  </div>
</div>

<style>
  .point-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .point-field__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .point-field__inputs {
    display: flex;
    gap: var(--space-8);
  }

  .point-field__axis {
    display: flex;
    align-items: center;
    flex: 1;
    height: var(--control-height);
    background: color-mix(in srgb, var(--bg-2) 30%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 0 var(--space-10);
    gap: var(--space-6);
    transition: border-color var(--dur-fast) var(--ease);
  }

  .point-field__axis:focus-within {
    border-color: var(--ink-faint);
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .point-field__axis-label {
    font-family: var(--font-sans);
    font-size: var(--t-label);
    color: var(--ink-faint);
  }

  .point-field__input {
    flex: 1;
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    font-variant-numeric: tabular-nums;
  }

  .point-field__input:focus {
    outline: none;
  }

  .point-field__input:disabled {
    cursor: not-allowed;
  }
</style>
