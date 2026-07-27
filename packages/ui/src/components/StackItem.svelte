<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon: Snippet;
    name: string;
    selected?: boolean;
    hidden?: boolean;
    dragging?: boolean;
    draggable?: boolean;
    onSelect?: () => void;
    onChange?: () => void;
    onToggleHide?: () => void;
    onRemove?: () => void;
    onDragStart?: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onDrop?: (event: DragEvent) => void;
    onDragEnd?: (event: DragEvent) => void;
  }

  let {
    icon,
    name,
    selected = false,
    hidden = false,
    dragging = false,
    draggable = false,
    onSelect,
    onChange,
    onToggleHide,
    onRemove,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  }: Props = $props();

  let menuOpen = $state(false);

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  }

  function handleChange(event: MouseEvent) {
    event.stopPropagation();
    onChange?.();
  }

  function toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function handleToggleHide(event: MouseEvent) {
    event.stopPropagation();
    menuOpen = false;
    onToggleHide?.();
  }

  function handleRemove(event: MouseEvent) {
    event.stopPropagation();
    menuOpen = false;
    onRemove?.();
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      menuOpen = false;
    }
  }
</script>

<svelte:window onclick={closeMenu} />

<div
  class="stack-item"
  class:stack-item--selected={selected}
  class:stack-item--hidden={hidden}
  class:stack-item--dragging={dragging}
  role="button"
  tabindex="0"
  aria-pressed={selected}
  {draggable}
  onclick={onSelect}
  onkeydown={handleKeydown}
  ondragstart={onDragStart}
  ondragover={onDragOver}
  ondrop={onDrop}
  ondragend={onDragEnd}
>
  <span class="stack-item__handle" aria-hidden="true">⠿</span>
  <span class="stack-item__icon">{@render icon()}</span>
  <span class="stack-item__name">{name}</span>
  <button class="stack-item__change" onclick={handleChange}>Changer</button>
  <div class="stack-item__menu-wrap" onkeydown={handleMenuKeydown}>
    <button
      class="stack-item__menu-trigger"
      onclick={toggleMenu}
      aria-haspopup="true"
      aria-expanded={menuOpen}
      aria-label="Actions sur {name}"
    >
      ⋮
    </button>
    {#if menuOpen}
      <div class="stack-item__menu" role="menu">
        <button class="stack-item__menu-item" role="menuitem" onclick={handleToggleHide}>
          {hidden ? 'Afficher' : 'Cacher'}
        </button>
        <button
          class="stack-item__menu-item stack-item__menu-item--danger"
          role="menuitem"
          onclick={handleRemove}
        >
          Retirer
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .stack-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    width: var(--stack-width);
    height: var(--stack-height);
    padding: 0 var(--space-10);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
  }

  .stack-item:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .stack-item--selected {
    border-color: var(--accent);
  }

  /* Contenu à 40% d'opacité, bordure inchangée (design system §3) — appliqué
     aux éléments de contenu, pas à `.stack-item` elle-même : lui donner une
     opacité créerait un nouveau contexte d'empilement CSS et empêcherait le
     menu ⋮ (z-index) de s'afficher au-dessus des éléments suivants de la page. */
  .stack-item--hidden .stack-item__handle,
  .stack-item--hidden .stack-item__icon,
  .stack-item--hidden .stack-item__name,
  .stack-item--hidden .stack-item__change {
    opacity: 0.4;
  }

  .stack-item--dragging {
    box-shadow: var(--shadow);
    transform: translateY(-1px);
  }

  .stack-item__handle {
    flex-shrink: 0;
    color: var(--ink-faint);
    line-height: 1;
    cursor: grab;
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease);
  }

  .stack-item:hover .stack-item__handle {
    opacity: 1;
  }

  .stack-item__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-16);
    height: var(--space-16);
    flex-shrink: 0;
    color: var(--ink-muted);
  }

  .stack-item__name {
    flex: 1;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    font-weight: 400;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stack-item__change {
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: var(--t-label);
    font-weight: 400;
    color: var(--accent);
    background: transparent;
    border: none;
    padding: var(--space-4);
    cursor: pointer;
  }

  .stack-item__change:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .stack-item__menu-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .stack-item__menu-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    font-family: var(--font-sans);
    color: var(--ink-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease);
  }

  .stack-item__menu-trigger:hover {
    color: var(--ink);
  }

  .stack-item__menu-trigger:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .stack-item__menu {
    position: absolute;
    top: calc(100% + var(--space-4));
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    min-width: 120px;
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: var(--shadow);
    padding: var(--space-4);
  }

  .stack-item__menu-item {
    padding: var(--space-6) var(--space-8);
    text-align: left;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink);
    background: transparent;
    border: none;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background-color var(--dur-fast) var(--ease);
  }

  .stack-item__menu-item:hover {
    background: var(--bg-2);
  }

  .stack-item__menu-item:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: calc(var(--focus-offset) * -1);
  }

  .stack-item__menu-item--danger {
    color: var(--danger);
  }
</style>
