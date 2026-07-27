<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="panel">
  {@render children()}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    width: var(--panel-width);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r);
    padding: var(--space-16);
  }
</style>
