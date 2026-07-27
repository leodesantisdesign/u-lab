<script lang="ts">
  import { onMount } from 'svelte';
  import { byCategory } from '@ulab/modules';
  import type { ModuleCategory, ModuleDef } from '@ulab/modules';
  import SectionLabel from './SectionLabel.svelte';

  interface Props {
    mode: 'add' | 'change';
    category?: ModuleCategory | null; // requis en mode 'change' : catégorie du module remplacé
    replacingType?: string | null; // type actuel du module remplacé, pour la bordure --accent
    currentTypes: string[]; // types déjà dans la pile, pour le grisé
    currentSourceType?: string | null; // type de la source actuelle, pour la coche
    onPick: (type: string) => void;
    onClose: () => void;
  }

  let {
    mode,
    category = null,
    replacingType = null,
    currentTypes,
    currentSourceType = null,
    onPick,
    onClose,
  }: Props = $props();

  const CATEGORIES: { key: ModuleCategory; label: string }[] = [
    { key: 'source', label: 'Source' },
    { key: 'traitement', label: 'Traitement' },
    { key: 'finition', label: 'Finition' },
  ];

  const visibleCategories = $derived(
    mode === 'change' && category ? CATEGORIES.filter((c) => c.key === category) : CATEGORIES,
  );

  let query = $state('');
  let modalEl: HTMLDivElement | undefined = $state();
  let searchEl: HTMLInputElement | undefined = $state();

  function matches(def: ModuleDef): boolean {
    const q = query.trim().toLowerCase();
    return q === '' || def.name.toLowerCase().includes(q);
  }

  function modulesFor(key: ModuleCategory): ModuleDef[] {
    return byCategory(key).filter(matches);
  }

  function isDisabled(def: ModuleDef): boolean {
    if (def.category === 'source') return false;
    return currentTypes.includes(def.type);
  }

  function pick(def: ModuleDef) {
    if (isDisabled(def)) return;
    onPick(def.type);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !modalEl) return;
    const focusables = modalEl.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    searchEl?.focus();
  });
</script>

{#snippet moduleIcon()}
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
    <rect width="8" height="8" fill="currentColor" />
  </svg>
{/snippet}

<div class="tools-modal__backdrop" onclick={onClose}>
  <div
    class="tools-modal"
    bind:this={modalEl}
    role="dialog"
    aria-modal="true"
    aria-label={mode === 'add' ? 'Ajouter un module' : 'Changer de module'}
    onclick={(event) => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="tools-modal__header">
      <input
        class="tools-modal__search"
        type="search"
        placeholder="Rechercher un module…"
        bind:value={query}
        bind:this={searchEl}
      />
      <button class="tools-modal__close" onclick={onClose} aria-label="Fermer">✕</button>
    </header>

    <div class="tools-modal__columns">
      {#each visibleCategories as cat (cat.key)}
        <div class="tools-modal__column">
          <SectionLabel text={cat.label} />
          {#if cat.key === 'source'}
            <div class="tools-modal__list">
              {#each modulesFor(cat.key) as def (def.type)}
                <button class="tools-modal__row" onclick={() => pick(def)}>
                  <span class="tools-modal__row-icon">{@render moduleIcon()}</span>
                  <span class="tools-modal__row-name">{def.name}</span>
                  {#if def.type === currentSourceType}
                    <span class="tools-modal__row-check" aria-hidden="true">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else}
            <div class="tools-modal__grid">
              {#each modulesFor(cat.key) as def (def.type)}
                <button
                  class="tools-modal__tile"
                  class:tools-modal__tile--active={def.type === replacingType}
                  class:tools-modal__tile--disabled={isDisabled(def)}
                  disabled={isDisabled(def)}
                  onclick={() => pick(def)}
                >
                  <span class="tools-modal__tile-thumb"></span>
                  <span class="tools-modal__tile-name">{def.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .tools-modal__backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--backdrop);
  }

  .tools-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    width: var(--modal-width);
    max-width: calc(100vw - var(--space-24) * 2);
    max-height: calc(100vh - var(--space-24) * 2);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: var(--shadow);
    padding: var(--space-16);
    overflow: hidden;
  }

  .tools-modal__header {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex-shrink: 0;
  }

  .tools-modal__search {
    flex: 1;
    height: var(--control-height);
    background: color-mix(in srgb, var(--bg-2) 30%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 0 var(--space-10);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: var(--t-sm);
  }

  .tools-modal__search:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .tools-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease);
  }

  .tools-modal__close:hover {
    color: var(--ink);
  }

  .tools-modal__close:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .tools-modal__columns {
    display: flex;
    gap: var(--space-24);
    overflow-y: auto;
  }

  .tools-modal__column {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    flex: 1;
    min-width: 0;
  }

  .tools-modal__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .tools-modal__row {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    width: 100%;
    padding: var(--space-8);
    background: transparent;
    border: none;
    border-radius: var(--r-lg);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--dur-fast) var(--ease);
  }

  .tools-modal__row:hover {
    background: var(--bg-2);
  }

  .tools-modal__row:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: calc(var(--focus-offset) * -1);
  }

  .tools-modal__row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-16);
    height: var(--space-16);
    flex-shrink: 0;
    color: var(--ink-muted);
  }

  .tools-modal__row-name {
    flex: 1;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink);
  }

  .tools-modal__row-check {
    color: var(--accent);
    font-size: var(--t-sm);
  }

  .tools-modal__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, var(--vignette-size));
    gap: var(--space-12);
  }

  .tools-modal__tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    width: var(--vignette-size);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .tools-modal__tile:focus-visible .tools-modal__tile-thumb {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .tools-modal__tile-thumb {
    width: var(--vignette-size);
    height: var(--vignette-size);
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    transition: border-color var(--dur-fast) var(--ease);
  }

  .tools-modal__tile--active .tools-modal__tile-thumb {
    border-color: var(--accent);
  }

  .tools-modal__tile--disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .tools-modal__tile-name {
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
</style>
