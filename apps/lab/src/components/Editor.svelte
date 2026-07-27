<script lang="ts">
  import { tick } from 'svelte';
  import { DocumentStore, createProject } from '@ulab/core';
  import type { ModuleInstance, Project } from '@ulab/core';
  import { byType } from '@ulab/modules';
  import type { ModuleCategory } from '@ulab/modules';
  import StackItem from '@ulab/ui/components/StackItem.svelte';
  import AddButton from '@ulab/ui/components/AddButton.svelte';
  import PreviewFrame from '@ulab/ui/components/PreviewFrame.svelte';
  import Inspector from '@ulab/ui/components/Inspector.svelte';
  import ToolsModal from '@ulab/ui/components/ToolsModal.svelte';
  import ModulationDrawer from '@ulab/ui/components/ModulationDrawer.svelte';
  import ExportModal from '@ulab/ui/components/ExportModal.svelte';
  import Select from '@ulab/ui/components/Select.svelte';
  import Button from '@ulab/ui/components/Button.svelte';

  const DEFAULT_STACK = ['source.image', 'traitement.halftone', 'finition.grain'];

  const RATIOS: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '4:5': { width: 1024, height: 1280 },
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
  };

  const QUALITY_FPS: Record<string, number> = { Basse: 15, Moyenne: 30, Haute: 60 };

  function instanceWithDefaults(type: string): ModuleInstance {
    const def = byType(type);
    const params: ModuleInstance['params'] = {};
    for (const param of def?.params ?? []) {
      params[param.key] = param.default;
    }
    return {
      id: crypto.randomUUID(),
      type,
      enabled: true,
      params,
      blend: { mode: 'normal', opacity: 1 },
    };
  }

  function buildDefaultProject(): Project {
    const project = createProject('Sans titre');
    project.stack = DEFAULT_STACK.map(instanceWithDefaults);
    return project;
  }

  const store = new DocumentStore(buildDefaultProject());

  // Signal « quelque chose vient d'être branché » (design system §5) : le
  // SEUL retour sur un changement de composition de la pile — ajout,
  // retrait ou remplacement d'un module. Un simple réordonnancement par
  // glisser-déposer ne rebranche rien, donc ne déclenche pas l'impulsion :
  // la signature est triée par id, indépendante de l'ordre.
  function stackSignature(stack: ModuleInstance[]): string {
    return stack
      .map((instance) => `${instance.id}:${instance.type}`)
      .sort()
      .join('|');
  }

  let lastStackSignature = stackSignature(store.project.stack);
  let pulseToken = $state(0);

  $effect(() => {
    const signature = stackSignature(store.project.stack);
    if (signature !== lastStackSignature) {
      lastStackSignature = signature;
      pulseToken++;
    }
  });

  function buildDefaults(type: string): Record<string, ModuleInstance['params'][string]> {
    const def = byType(type);
    const params: Record<string, ModuleInstance['params'][string]> = {};
    for (const param of def?.params ?? []) {
      params[param.key] = param.default;
    }
    return params;
  }

  function addModuleWithDefaults(type: string, atIndex?: number): void {
    store.addModule(type, buildDefaults(type), atIndex);
  }

  function handleReset() {
    const instance = store.selectedModule;
    if (!instance) return;
    store.resetParams(instance.id, buildDefaults(instance.type));
  }

  // Réordonnancement de la pile : Pointer Events (souris, tactile, stylet en un
  // seul chemin). La poignée capture le pointeur ; en dessous de 4px de
  // mouvement, ce n'est pas un déplacement (permet de cliquer sans glisser).
  // L'insertion vise l'interstice le plus proche du pointeur, pas la ligne
  // survolée : on compare la position du pointeur au milieu de chaque ligne
  // (mesuré à l'ouverture du geste), jamais à ses bords.
  const DRAG_THRESHOLD_PX = 4;

  let selectRefs: Record<string, HTMLButtonElement> = {};

  function registerSelectRef(id: string) {
    return (element: HTMLButtonElement | null) => {
      if (element) selectRefs[id] = element;
      else delete selectRefs[id];
    };
  }

  let dragFromIndex: number | null = $state(null);
  let dragInsertIndex: number | null = $state(null);
  let dragOffsetY = $state(0);
  let isDragging = $state(false);
  let announcement = $state('');

  let dragPointerId: number | null = null;
  let dragPendingIndex: number | null = null;
  let dragStartClientY = 0;
  let dragRowRects: DOMRect[] = [];
  let dragSlotSize = 0;

  function moveAndAnnounce(from: number, to: number) {
    const instance = store.project.stack[from];
    store.moveModule(from, to);
    if (instance) {
      const def = byType(instance.type);
      announcement = `${def?.name ?? instance.type} déplacé en position ${to + 1} sur ${store.project.stack.length}`;
    }
  }

  function computeInsertIndex(pointerClientY: number): number {
    for (let i = 0; i < dragRowRects.length; i++) {
      const rect = dragRowRects[i];
      if (rect && pointerClientY < (rect.top + rect.bottom) / 2) return i;
    }
    return dragRowRects.length;
  }

  function beginDrag(index: number) {
    dragFromIndex = index;
    dragInsertIndex = index;
    isDragging = true;
    dragRowRects = store.project.stack.map(
      (instance) => selectRefs[instance.id]?.getBoundingClientRect() ?? new DOMRect(),
    );
    const first = dragRowRects[0];
    const second = dragRowRects[1];
    dragSlotSize = first && second ? second.top - first.top : (first?.height ?? 0);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== dragPointerId || dragPendingIndex === null) return;
    const deltaY = event.clientY - dragStartClientY;

    if (!isDragging) {
      if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return;
      beginDrag(dragPendingIndex);
    }

    dragOffsetY = deltaY;
    dragInsertIndex = computeInsertIndex(event.clientY);
  }

  function endDrag(commit: boolean) {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);

    if (commit && isDragging && dragFromIndex !== null && dragInsertIndex !== null) {
      const from = dragFromIndex;
      const to = dragInsertIndex <= from ? dragInsertIndex : dragInsertIndex - 1;
      if (to !== from) moveAndAnnounce(from, to);
    }

    dragPointerId = null;
    dragPendingIndex = null;
    isDragging = false;
    dragFromIndex = null;
    dragInsertIndex = null;
    dragOffsetY = 0;
    dragRowRects = [];
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerId !== dragPointerId) return;
    endDrag(true);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (event.pointerId !== dragPointerId) return;
    endDrag(false);
  }

  function handleHandlePointerDown(index: number, event: PointerEvent) {
    dragPendingIndex = index;
    dragPointerId = event.pointerId;
    dragStartClientY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function rowTranslateY(index: number): number {
    if (!isDragging || dragFromIndex === null || dragInsertIndex === null) return 0;
    if (index === dragFromIndex) return dragOffsetY;
    if (dragInsertIndex > dragFromIndex) {
      return index > dragFromIndex && index < dragInsertIndex ? -dragSlotSize : 0;
    }
    if (dragInsertIndex < dragFromIndex) {
      return index >= dragInsertIndex && index < dragFromIndex ? dragSlotSize : 0;
    }
    return 0;
  }

  function focusRow(id: string) {
    tick().then(() => selectRefs[id]?.focus());
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const instance = store.project.stack[index];
    moveAndAnnounce(index, index - 1);
    if (instance) focusRow(instance.id);
  }

  function handleMoveDown(index: number) {
    if (index >= store.project.stack.length - 1) return;
    const instance = store.project.stack[index];
    moveAndAnnounce(index, index + 1);
    if (instance) focusRow(instance.id);
  }

  let quality: 'Basse' | 'Moyenne' | 'Haute' = $state('Moyenne');
  let ratio = $state('1:1');
  let showBefore = $state(false);

  type ToolsModalState =
    | { mode: 'add' }
    | { mode: 'change'; instanceId: string; category: ModuleCategory; replacingType: string };

  let toolsModal: ToolsModalState | null = $state(null);

  function openAddModal() {
    toolsModal = { mode: 'add' };
  }

  function openChangeModal(instanceId: string, instanceType: string) {
    const def = byType(instanceType);
    if (!def) return;
    toolsModal = {
      mode: 'change',
      instanceId,
      category: def.category,
      replacingType: instanceType,
    };
  }

  function closeToolsModal() {
    toolsModal = null;
  }

  function handlePick(type: string) {
    if (!toolsModal) return;
    if (toolsModal.mode === 'add') {
      addModuleWithDefaults(type);
    } else {
      store.replaceModule(toolsModal.instanceId, type, buildDefaults(type));
    }
    closeToolsModal();
  }

  const toolsModalCurrentTypes = $derived(
    toolsModal && toolsModal.mode === 'change'
      ? store.project.stack.filter((m) => m.id !== toolsModal.instanceId).map((m) => m.type)
      : store.project.stack.map((m) => m.type),
  );

  function handleRatioChange(next: string) {
    ratio = next;
    const size = RATIOS[next];
    if (size) {
      store.setFormat({ ratio: next, width: size.width, height: size.height });
    }
  }

  const selectedDef = $derived(
    store.selectedModule ? (byType(store.selectedModule.type) ?? null) : null,
  );
  const sourceDef = $derived(store.source ? (byType(store.source.type) ?? null) : null);
  const previewSize = $derived(RATIOS[ratio] ?? RATIOS['1:1']);

  // L'onglet Vidéo de l'export dépend de la catégorie et du type de la
  // SOURCE (stack[0]), pas d'un module quelconque de la pile.
  const ANIMATED_SOURCE_TYPES = ['source.video', 'source.webcam'];
  const animatedSource = $derived(
    sourceDef?.category === 'source' && ANIMATED_SOURCE_TYPES.includes(sourceDef.type),
  );

  let showExportModal = $state(false);

  const modulationTargetOptions = $derived(
    store.project.stack.flatMap((instance) => {
      const def = byType(instance.type);
      if (!def) return [];
      return def.params
        .filter((param) => param.type === 'number')
        .map((param) => ({
          moduleId: instance.id,
          paramKey: param.key,
          label: `${def.name} · ${param.label}`,
        }));
    }),
  );

  function handleAddModulation() {
    const first = modulationTargetOptions[0];
    if (!first) return;
    store.addModulation(
      { moduleId: first.moduleId, paramKey: first.paramKey },
      { kind: 'keyframes', points: [] },
    );
  }
</script>

{#snippet moduleIcon()}
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
    <rect width="8" height="8" fill="currentColor" />
  </svg>
{/snippet}

<div class="editor">
  <header class="editor__topbar">
    <div class="editor__topbar-left">
      <span class="editor__logo">U.LAB</span>
      <div class="editor__quality">
        <Select
          label="Qualité d'aperçu"
          options={Object.keys(QUALITY_FPS).map((key) => ({ label: key, value: key }))}
          bind:value={() => quality, (v) => (quality = v as typeof quality)}
        />
        <span class="editor__fps">{QUALITY_FPS[quality]} i/s</span>
      </div>
    </div>
    <div class="editor__topbar-right">
      <Button variant="ghost">Modèles</Button>
      <Button variant="secondary">Sauvegarder</Button>
    </div>
  </header>

  <div class="editor__workspace">
    <div class="editor__inspector-anchor">
      <Inspector
        def={selectedDef}
        instance={store.selectedModule}
        icon={moduleIcon}
        onClose={() => (store.selectedModuleId = null)}
        onReset={handleReset}
        onParamChange={(key, value) => {
          const instance = store.selectedModule;
          if (instance) store.setParam(instance.id, key, value);
        }}
        onBlendChange={(blend) => {
          const instance = store.selectedModule;
          if (instance) store.setBlend(instance.id, blend);
        }}
      />
    </div>

    <div class="editor__spine">
      <ul class="editor__stack" role="list">
        {#each store.project.stack as instance, index (instance.id)}
          {@const def = byType(instance.type)}
          <StackItem
            icon={moduleIcon}
            name={def?.name ?? instance.type}
            selected={store.selectedModuleId === instance.id}
            hidden={!instance.enabled}
            dragging={isDragging && dragFromIndex === index}
            translateY={rowTranslateY(index)}
            onSelect={() => (store.selectedModuleId = instance.id)}
            onChange={() => openChangeModal(instance.id, instance.type)}
            onToggleHide={() => store.toggleModule(instance.id)}
            onRemove={() => store.removeModule(instance.id)}
            onHandlePointerDown={(e) => handleHandlePointerDown(index, e)}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
            selectRef={registerSelectRef(instance.id)}
          />
        {/each}
      </ul>
      <div class="sr-only" aria-live="polite">{announcement}</div>

      <div class="editor__thread">
        <div class="editor__thread-line"></div>
        {#if pulseToken}
          {#key pulseToken}
            <div class="editor__thread-pulse" aria-hidden="true"></div>
          {/key}
        {/if}
        <div class="editor__add">
          <AddButton onclick={openAddModal} />
        </div>
      </div>

      <div class="editor__preview-area">
        <div class="editor__preview-wrap" style:aspect-ratio={ratio.replace(':', ' / ')}>
          <PreviewFrame
            ratio={ratio}
            width={previewSize.width}
            height={previewSize.height}
            label="Pile : {sourceDef?.name ?? '—'}"
            pulseToken={pulseToken}
          >
            {#snippet children()}
              <img class="editor__preview-image" src="/placeholder.svg" alt="" />
            {/snippet}
            {#snippet ratioControl()}
              <Select
                label="Ratio"
                options={Object.keys(RATIOS).map((key) => ({ label: key, value: key }))}
                bind:value={() => ratio, handleRatioChange}
              />
            {/snippet}
          </PreviewFrame>
        </div>

        <div class="editor__preview-controls">
          <Button variant="secondary" onclick={() => (showBefore = !showBefore)}>
            {showBefore ? 'Après' : 'Avant / après'}
          </Button>
          <Button variant="primary" onclick={() => (showExportModal = true)}>Exporter</Button>
        </div>
      </div>
    </div>
  </div>

  <ModulationDrawer
    duration={store.project.duration}
    fps={store.project.fps}
    modulations={store.project.modulations}
    targetOptions={modulationTargetOptions}
    onAdd={handleAddModulation}
    onRemove={(id) => store.removeModulation(id)}
    onMove={(from, to) => store.moveModulation(from, to)}
    onToggle={(id) => store.toggleModulation(id)}
    onTargetChange={(id, target) => store.setModulationTarget(id, target)}
    onSourceChange={(id, source) => store.setModulationSource(id, source)}
    onSensitivityChange={(id, sensitivity) => store.setModulationSensitivity(id, sensitivity)}
    onRangeChange={(id, range) => store.setModulationRange(id, range)}
  />
</div>

{#if toolsModal}
  <ToolsModal
    mode={toolsModal.mode}
    category={toolsModal.mode === 'change' ? toolsModal.category : null}
    replacingType={toolsModal.mode === 'change' ? toolsModal.replacingType : null}
    currentTypes={toolsModalCurrentTypes}
    currentSourceType={store.source?.type ?? null}
    onPick={handlePick}
    onClose={closeToolsModal}
  />
{/if}

{#if showExportModal}
  <ExportModal
    format={store.project.format}
    duration={store.project.duration}
    fps={store.project.fps}
    animatedSource={animatedSource}
    onClose={() => (showExportModal = false)}
  />
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-0);
  }

  .editor__topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--topbar-height);
    flex-shrink: 0;
    padding: 0 var(--space-16);
    background: var(--bg-0);
    border-bottom: 1px solid var(--line);
  }

  .editor__topbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-16);
  }

  .editor__logo {
    font-family: var(--font-sans);
    font-size: var(--t-h4);
    font-weight: 500;
    color: var(--ink);
  }

  .editor__quality {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .editor__fps {
    font-family: var(--font-mono);
    font-size: var(--t-micro);
    color: var(--ink-faint);
  }

  .editor__topbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .editor__workspace {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-24);
    overflow: auto;
  }

  /* Sous ~600px, pas assez de largeur pour flotter à gauche de la pile sans
     la recouvrir : l'inspecteur rejoint le flux normal, sous la pile et
     l'aperçu, plutôt que de se superposer dessus par défaut. */
  .editor__inspector-anchor {
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 0 var(--space-24) var(--space-16);
    order: 1;
  }

  @media (min-width: 600px) {
    .editor__inspector-anchor {
      position: absolute;
      top: var(--space-24);
      left: var(--space-24);
      z-index: 20;
      width: auto;
      padding: 0;
      order: 0;
    }
  }

  .editor__spine {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .editor__stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .editor__thread {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
  }

  .editor__thread-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background: var(--line);
    pointer-events: none;
  }

  /* Impulsion --accent qui parcourt le fil de haut en bas — le seul retour
     « quelque chose vient d'être branché » (design system §5). {#key} force
     un nouvel élément à chaque déclenchement pour rejouer l'animation. */
  .editor__thread-pulse {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
    background: linear-gradient(to bottom, transparent, var(--accent), transparent);
    background-size: 100% 50%;
    background-repeat: no-repeat;
    background-position: 0 -50%;
    pointer-events: none;
    animation: thread-pulse var(--dur-pulse) var(--ease);
  }

  @keyframes thread-pulse {
    from {
      background-position: 0 -50%;
    }
    to {
      background-position: 0 150%;
    }
  }

  .editor__add {
    position: relative;
    z-index: 1;
    background: var(--bg-0);
    display: flex;
  }

  .editor__preview-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-16);
    margin-top: var(--space-8);
  }

  .editor__preview-wrap {
    position: relative;
    width: min(70vw, 640px);
  }

  .editor__preview-image {
    max-width: 100%;
    max-height: 100%;
    image-rendering: pixelated;
  }

  .editor__preview-controls {
    display: flex;
    align-items: center;
    gap: var(--space-16);
  }

</style>
