<script lang="ts">
  interface Option {
    label: string;
    value: string;
  }

  interface Props {
    label: string;
    options: Option[];
    value: string;
    disabled?: boolean;
  }

  let { label, options, value = $bindable(), disabled = false }: Props = $props();
</script>

<div class="select" class:select--disabled={disabled}>
  <select aria-label={label} {disabled} bind:value>
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  <svg class="select__chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
    <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</div>

<style>
  .select {
    position: relative;
    height: var(--control-height);
    min-width: var(--tap-target-min);
  }

  .select--disabled {
    opacity: 0.5;
  }

  select {
    width: 100%;
    height: 100%;
    appearance: none;
    -webkit-appearance: none;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    font-weight: 400;
    color: var(--ink);
    background-color: color-mix(in srgb, var(--bg-2) 30%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 0 var(--space-24) 0 var(--space-10);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease);
  }

  select:disabled {
    cursor: not-allowed;
  }

  select:hover:not(:disabled) {
    border-color: var(--ink-faint);
  }

  select:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .select__chevron {
    position: absolute;
    top: 50%;
    right: var(--space-10);
    transform: translateY(-50%);
    color: var(--ink-muted);
    pointer-events: none;
  }
</style>
