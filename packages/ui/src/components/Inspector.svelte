<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ModuleDef } from '@ulab/modules';
  import type { BlendMode, ModuleInstance, ParamValue } from '@ulab/core';
  import SectionLabel from './SectionLabel.svelte';
  import ParamRow from './ParamRow.svelte';
  import Select from './Select.svelte';
  import SliderRow from './SliderRow.svelte';
  import Button from './Button.svelte';

  const BLEND_MODE_OPTIONS: { label: string; value: BlendMode }[] = [
    { label: 'Normal', value: 'normal' },
    { label: 'Produit', value: 'multiply' },
    { label: 'Écran', value: 'screen' },
    { label: 'Superposition', value: 'overlay' },
    { label: 'Différence', value: 'difference' },
    { label: 'Addition', value: 'add' },
  ];

  type Tab = 'commandes' | 'effets';

  interface Props {
    def: ModuleDef | null;
    instance: ModuleInstance | null;
    icon?: Snippet;
    onClose?: () => void;
    onReset?: () => void;
    onParamChange?: (key: string, value: ParamValue) => void;
    onBlendChange?: (blend: { mode: BlendMode; opacity: number }) => void;
  }

  let { def, instance, icon, onClose, onReset, onParamChange, onBlendChange }: Props = $props();

  let activeTab: Tab = $state('commandes');
  let offset = $state({ x: 0, y: 0 });
  let dragStart: { x: number; y: number; originX: number; originY: number } | null = null;

  const showEffectsTab = $derived(def ? def.category !== 'source' : false);

  $effect(() => {
    if (!showEffectsTab && activeTab === 'effets') activeTab = 'commandes';
  });

  function startDrag(event: PointerEvent) {
    dragStart = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onDrag(event: PointerEvent) {
    if (!dragStart) return;
    offset = {
      x: dragStart.originX + (event.clientX - dragStart.x),
      y: dragStart.originY + (event.clientY - dragStart.y),
    };
  }

  function endDrag() {
    dragStart = null;
  }

  function blendMode(): BlendMode {
    return instance ? instance.blend.mode : 'normal';
  }

  function blendOpacity(): number {
    return instance ? instance.blend.opacity : 1;
  }

  function setBlendMode(mode: BlendMode) {
    if (instance) onBlendChange?.({ mode, opacity: instance.blend.opacity });
  }

  function setBlendOpacity(opacity: number) {
    if (instance) onBlendChange?.({ mode: instance.blend.mode, opacity });
  }
</script>

<div class="inspector" style:transform="translate({offset.x}px, {offset.y}px)">
  {#if !def || !instance}
    <p class="inspector__empty">Sélectionnez un module dans la pile pour régler ses paramètres.</p>
  {:else}
    <header
      class="inspector__header"
      onpointerdown={startDrag}
      onpointermove={onDrag}
      onpointerup={endDrag}
    >
      <span class="inspector__handle" aria-hidden="true">⠿</span>
      {#if icon}
        <span class="inspector__icon">{@render icon()}</span>
      {/if}
      <span class="inspector__name">{def.name}</span>
      <button class="inspector__close" onclick={onClose} aria-label="Fermer l'inspecteur">✕</button>
    </header>

    <div class="inspector__tabs" role="tablist">
      <button
        class="inspector__tab"
        class:inspector__tab--active={activeTab === 'commandes'}
        role="tab"
        aria-selected={activeTab === 'commandes'}
        onclick={() => (activeTab = 'commandes')}
      >
        Commandes
      </button>
      {#if showEffectsTab}
        <button
          class="inspector__tab"
          class:inspector__tab--active={activeTab === 'effets'}
          role="tab"
          aria-selected={activeTab === 'effets'}
          onclick={() => (activeTab = 'effets')}
        >
          Effets
        </button>
      {/if}
    </div>

    <div class="inspector__body">
      {#if activeTab === 'commandes' || !showEffectsTab}
        {#if def.params.length === 0}
          <p class="inspector__body-empty">Ce module n'a aucun réglage.</p>
        {:else}
          {#each def.params as param (param.key)}
            <ParamRow
              {param}
              bind:value={() => instance.params[param.key], (v) => onParamChange?.(param.key, v)}
            />
          {/each}
        {/if}
      {:else}
        <SectionLabel text="Fusion" />
        <Select
          label="Mode de fusion"
          options={BLEND_MODE_OPTIONS}
          bind:value={() => blendMode(), setBlendMode}
        />
        <SliderRow
          label="Opacité"
          bind:value={() => blendOpacity(), setBlendOpacity}
          min={0}
          max={1}
          step={0.01}
        />
      {/if}
    </div>

    <footer class="inspector__footer">
      <Button variant="secondary" onclick={onReset}>Réinitialiser les réglages</Button>
    </footer>
  {/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    width: var(--panel-width);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: var(--shadow);
  }

  .inspector__empty {
    padding: var(--space-16);
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink-muted);
  }

  .inspector__header {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-10) var(--space-12);
    border-bottom: 1px solid var(--line);
    cursor: grab;
    touch-action: none;
  }

  .inspector__header:active {
    cursor: grabbing;
  }

  .inspector__handle {
    color: var(--ink-faint);
    line-height: 1;
  }

  .inspector__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-16);
    height: var(--space-16);
    flex-shrink: 0;
    color: var(--ink-muted);
  }

  .inspector__name {
    flex: 1;
    font-family: var(--font-sans);
    font-size: var(--t-h4);
    font-weight: 500;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inspector__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease);
  }

  .inspector__close:hover {
    color: var(--ink);
  }

  .inspector__close:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .inspector__tabs {
    display: flex;
    gap: var(--space-16);
    padding: 0 var(--space-12);
    border-bottom: 1px solid var(--line);
  }

  .inspector__tab {
    padding: var(--space-10) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
  }

  .inspector__tab:hover {
    color: var(--ink);
  }

  .inspector__tab:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .inspector__tab--active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .inspector__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-16) var(--space-12);
  }

  .inspector__body-empty {
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink-muted);
  }

  .inspector__footer {
    padding: var(--space-12);
    border-top: 1px solid var(--line);
  }

  .inspector__footer :global(.btn) {
    width: 100%;
  }
</style>
