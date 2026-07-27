<script lang="ts">
  interface Props {
    label?: string;
    onclick?: () => void;
  }

  let { label = 'Ajouter un module', onclick }: Props = $props();
</script>

<button class="add-button" aria-label={label} {onclick}>
  <span class="add-button__hit-area" aria-hidden="true"></span>
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path d="M5 0V10M0 5H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
</button>

<style>
  .add-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--ink-muted);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
  }

  .add-button__hit-area {
    position: absolute;
    inset: calc((20px - var(--tap-target-min)) / 2);
  }

  .add-button:hover {
    border-color: var(--ink-faint);
    color: var(--ink);
  }

  .add-button:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }
</style>
