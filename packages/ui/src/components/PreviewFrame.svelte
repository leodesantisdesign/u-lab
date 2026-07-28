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
    pulseToken?: number;
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
    pulseToken = 0,
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
  <!-- Le seul retour « quelque chose vient d'être branché » (design system §5) :
       la bordure s'allume brièvement quand la pile change. -->
  {#if pulseToken}
    {#key pulseToken}
      <div class="preview-frame__pulse" aria-hidden="true"></div>
    {/key}
  {/if}
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

  /* Le canevas du moteur arrive en enfant (snippet children), donc hors de
     la portée de style de ce composant : :global est nécessaire pour
     l'atteindre. Il remplit .preview-frame__content sans en déformer le
     contenu — object-fit: contain, jamais cover ni fill. */
  .preview-frame__content :global(canvas) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .preview-frame__pulse {
    position: absolute;
    inset: -1px;
    border-radius: var(--r-lg);
    border: 1px solid var(--accent);
    opacity: 0;
    pointer-events: none;
    animation: preview-pulse var(--dur-pulse) var(--ease);
  }

  @keyframes preview-pulse {
    0% {
      opacity: 0;
    }
    25% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
