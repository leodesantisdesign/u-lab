<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon: Snippet;
    name: string;
    selected?: boolean;
    hidden?: boolean;
    dragging?: boolean;
    translateY?: number;
    onSelect?: () => void;
    onChange?: () => void;
    onToggleHide?: () => void;
    onRemove?: () => void;
    onHandlePointerDown?: (event: PointerEvent) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    selectRef?: (element: HTMLButtonElement | null) => void;
  }

  let {
    icon,
    name,
    selected = false,
    hidden = false,
    dragging = false,
    translateY = 0,
    onSelect,
    onChange,
    onToggleHide,
    onRemove,
    onHandlePointerDown,
    onMoveUp,
    onMoveDown,
    selectRef,
  }: Props = $props();

  let menuOpen = $state(false);
  let removing = $state(false);
  let selectEl: HTMLButtonElement | undefined = $state();
  let surfaceEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    selectRef?.(selectEl ?? null);
    return () => selectRef?.(null);
  });

  // Sous prefers-reduced-motion, --dur vaut 0ms : certains navigateurs ne
  // déclenchent jamais `animationend` pour une animation de durée nulle, ce
  // qui bloquerait le retrait pour de bon. Filet de sécurité : si la durée
  // calculée est nulle, on retire immédiatement sans attendre l'événement.
  $effect(() => {
    if (!removing || !surfaceEl) return;
    if (getComputedStyle(surfaceEl).animationDuration === '0s') onRemove?.();
  });

  function handleSelectKeydown(event: KeyboardEvent) {
    if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault();
      onMoveUp?.();
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      onMoveDown?.();
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

  // La suppression réelle attend la fin de l'animation de disparition
  // (voir handleAnimationEnd) — retirer l'entrée du document avant que la
  // carte ait fini de s'effacer romprait la symétrie apparition/disparition.
  function handleRemove(event: MouseEvent) {
    event.stopPropagation();
    menuOpen = false;
    removing = true;
  }

  function handleAnimationEnd() {
    if (removing) onRemove?.();
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      menuOpen = false;
    }
  }
</script>

<svelte:window onclick={menuOpen ? closeMenu : undefined} />

<li
  class="stack-item"
  class:stack-item--dragging={dragging}
  class:stack-item--menu-open={menuOpen}
  style:transform="translateY({translateY}px)"
>
  <div
    bind:this={surfaceEl}
    class="stack-item__surface"
    class:stack-item__surface--selected={selected}
    class:stack-item__surface--hidden={hidden}
    class:stack-item__surface--dragging={dragging}
    class:stack-item__surface--removing={removing}
    onanimationend={handleAnimationEnd}
  >
    <span
      class="stack-item__handle"
      aria-hidden="true"
      onpointerdown={(event) => onHandlePointerDown?.(event)}
    >⠿</span>

    <button
      bind:this={selectEl}
      class="stack-item__select"
      aria-pressed={selected}
      onclick={onSelect}
      onkeydown={handleSelectKeydown}
    >
      <span class="stack-item__icon">{@render icon()}</span>
      <span class="stack-item__name">{name}</span>
    </button>

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
</li>

<style>
  @keyframes stack-item-in {
    from {
      opacity: 0;
      transform: translateY(calc(var(--space-6) * -1));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes stack-item-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(calc(var(--space-6) * -1));
    }
  }

  .stack-item {
    width: var(--stack-width);
    transition: transform var(--dur-fast) var(--ease);
  }

  .stack-item--dragging {
    z-index: 5;
    transition: none;
  }

  /* La transition d'entrée sur .stack-item__surface (transform + opacity)
     lui crée un contexte d'empilement propre dans les navigateurs modernes,
     même une fois l'animation terminée — sans z-index explicite ici, le
     menu ⋮ d'une ligne ne peut plus s'afficher au-dessus de la ligne
     suivante, qui le recouvre en étant peinte après elle dans le DOM. */
  .stack-item--menu-open {
    z-index: 10;
  }

  .stack-item__surface {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    width: 100%;
    height: var(--stack-height);
    padding: 0 var(--space-10);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
    animation: stack-item-in var(--dur) var(--ease);
  }

  .stack-item__surface--selected {
    border-color: var(--accent);
  }

  /* Contenu à 40% d'opacité, bordure inchangée (design system §3) — appliqué
     aux éléments de contenu, pas à la carte elle-même : lui donner une
     opacité créerait un nouveau contexte d'empilement CSS et empêcherait le
     menu ⋮ (z-index) de s'afficher au-dessus des éléments suivants de la page. */
  .stack-item__surface--hidden .stack-item__handle,
  .stack-item__surface--hidden .stack-item__select,
  .stack-item__surface--hidden .stack-item__change {
    opacity: 0.4;
  }

  .stack-item__surface--dragging {
    box-shadow: var(--shadow);
  }

  .stack-item__surface--removing {
    animation: stack-item-out var(--dur) var(--ease) both;
  }

  .stack-item__handle {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--ink-faint);
    line-height: 1;
    cursor: grab;
    opacity: 0;
    touch-action: none;
    transition: opacity var(--dur-fast) var(--ease);
  }

  .stack-item__surface:hover .stack-item__handle {
    opacity: 1;
  }

  .stack-item__surface--dragging .stack-item__handle {
    opacity: 1;
    cursor: grabbing;
  }

  .stack-item__select {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    flex: 1;
    min-width: 0;
    font: inherit;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .stack-item__select:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
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
    min-width: 0;
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
