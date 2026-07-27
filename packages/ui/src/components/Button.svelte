<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost';
    children: Snippet;
  }

  let { variant = 'secondary', children, class: className, ...rest }: Props = $props();
</script>

<button class="btn btn--{variant} {className ?? ''}" {...rest}>
  <span class="btn__hit-area" aria-hidden="true"></span>
  {@render children()}
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--button-height);
    padding: var(--button-padding);
    border-radius: var(--r-lg);
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 500;
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease),
      border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease),
      opacity var(--dur-fast) var(--ease);
  }

  /* Cible tactile : la boîte visible fait 34px, la zone cliquable est étendue à 44px */
  .btn__hit-area {
    position: absolute;
    inset: calc((var(--button-height) - var(--tap-target-min)) / 2) 0;
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .btn:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .btn--primary {
    background: var(--accent);
    border: none;
    color: var(--accent-ink);
  }

  .btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn--secondary {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--ink);
  }

  .btn--secondary:hover:not(:disabled) {
    border-color: var(--ink-faint);
  }

  .btn--ghost {
    background: transparent;
    border: none;
    color: var(--ink-muted);
  }

  .btn--ghost:hover:not(:disabled) {
    color: var(--ink);
  }
</style>
