<script lang="ts">
  interface Props {
    label: string;
    value: boolean;
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();
</script>

<label class="switch" class:switch--disabled={disabled}>
  <span class="switch__label">{label}</span>
  <span class="switch__track" class:switch__track--on={value}>
    <input
      class="switch__input"
      type="checkbox"
      role="switch"
      aria-checked={value}
      aria-label={label}
      {disabled}
      bind:checked={value}
    />
    <span class="switch__thumb"></span>
  </span>
</label>

<style>
  .switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-8);
    width: 100%;
    cursor: pointer;
  }

  .switch--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .switch__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .switch__track {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: var(--switch-width);
    height: var(--switch-height);
    flex-shrink: 0;
    background: var(--bg-2);
    border-radius: calc(var(--switch-height) / 2);
    transition: background-color var(--dur-fast) var(--ease);
  }

  .switch__track--on {
    background: var(--accent);
  }

  .switch__input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .switch--disabled .switch__input {
    cursor: not-allowed;
  }

  .switch__thumb {
    position: absolute;
    left: calc((var(--switch-height) - var(--thumb-size)) / 2);
    width: var(--thumb-size);
    height: var(--thumb-size);
    border-radius: 50%;
    background: var(--ink);
    transition: transform var(--dur-fast) var(--ease);
    pointer-events: none;
  }

  .switch__track--on .switch__thumb {
    transform: translateX(calc(var(--switch-width) - var(--switch-height)));
  }

  .switch__track:focus-within {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }
</style>
