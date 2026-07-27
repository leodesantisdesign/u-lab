<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    ratio: string;
    width: number;
    height: number;
    label?: string;
    src?: string;
    alt?: string;
    children?: Snippet;
    ratioControl?: Snippet;
  }

  let {
    ratio,
    width,
    height,
    label = 'Aperçu',
    src,
    alt = '',
    children,
    ratioControl,
  }: Props = $props();
</script>

<div class="preview-frame">
  <span class="preview-frame__label">{label}</span>
  {#if ratioControl}
    <span class="preview-frame__ratio-control">{@render ratioControl()}</span>
  {:else}
    <span class="preview-frame__ratio">{ratio}</span>
  {/if}
  <span class="preview-frame__dimensions">{width} × {height}</span>
  <div class="preview-frame__content">
    {#if children}
      {@render children()}
    {:else if src}
      <img class="preview-frame__image" {src} {alt} />
    {/if}
  </div>
</div>

<style>
  .preview-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  .preview-frame__label,
  .preview-frame__ratio,
  .preview-frame__dimensions {
    position: absolute;
    font-family: var(--font-sans);
    font-size: var(--t-micro);
    font-weight: 500;
    color: var(--ink-faint);
  }

  .preview-frame__label {
    top: var(--space-12);
    left: var(--space-12);
    text-transform: uppercase;
    letter-spacing: var(--tracking-label);
  }

  .preview-frame__ratio {
    top: var(--space-12);
    right: var(--space-12);
    font-family: var(--font-mono);
  }

  .preview-frame__ratio-control {
    position: absolute;
    top: var(--space-12);
    right: var(--space-12);
    width: 90px;
  }

  .preview-frame__dimensions {
    bottom: var(--space-12);
    right: var(--space-12);
    font-family: var(--font-mono);
  }

  .preview-frame__content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .preview-frame__image {
    max-width: 100%;
    max-height: 100%;
    image-rendering: pixelated;
  }
</style>
