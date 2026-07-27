<script lang="ts">
  interface Props {
    label: string;
    value: string;
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();
</script>

<div class="text-area">
  <span class="text-area__label">{label}</span>
  <textarea class="text-area__input" aria-label={label} rows="3" {disabled} bind:value
  ></textarea>
</div>

<style>
  .text-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .text-area__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .text-area__input {
    width: 100%;
    resize: vertical;
    background: color-mix(in srgb, var(--bg-2) 30%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: var(--space-8) var(--space-10);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    line-height: 1.4;
    transition: border-color var(--dur-fast) var(--ease);
  }

  .text-area__input:hover:not(:disabled) {
    border-color: var(--ink-faint);
  }

  .text-area__input:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .text-area__input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
