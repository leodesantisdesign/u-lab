<script lang="ts">
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

  function applyDefaults(instanceId: string, type: string): void {
    const def = byType(type);
    for (const param of def?.params ?? []) {
      store.setParam(instanceId, param.key, param.default);
    }
  }

  function addModuleWithDefaults(type: string, atIndex?: number): void {
    const id = store.addModule(type, atIndex);
    applyDefaults(id, type);
  }

  function handleReset() {
    const instance = store.selectedModule;
    const def = instance ? byType(instance.type) : null;
    if (!instance || !def) return;
    for (const param of def.params) {
      store.setParam(instance.id, param.key, param.default);
    }
  }

  let draggedIndex: number | null = $state(null);

  function handleDragStart(index: number, event: DragEvent) {
    draggedIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(index: number, event: DragEvent) {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    store.moveModule(draggedIndex, index);
    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
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
      store.replaceModule(toolsModal.instanceId, type);
      applyDefaults(toolsModal.instanceId, type);
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
      store.project.format = { ratio: next, width: size.width, height: size.height };
    }
  }

  const selectedDef = $derived(
    store.selectedModule ? (byType(store.selectedModule.type) ?? null) : null,
  );
  const sourceDef = $derived(store.source ? (byType(store.source.type) ?? null) : null);
  const previewSize = $derived(RATIOS[ratio] ?? RATIOS['1:1']);

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
      />
    </div>

    <div class="editor__spine">
      <div class="editor__stack">
        {#each store.project.stack as instance, index (instance.id)}
          {@const def = byType(instance.type)}
          <StackItem
            icon={moduleIcon}
            name={def?.name ?? instance.type}
            selected={store.selectedModuleId === instance.id}
            hidden={!instance.enabled}
            dragging={draggedIndex === index}
            draggable={true}
            onSelect={() => (store.selectedModuleId = instance.id)}
            onChange={() => openChangeModal(instance.id, instance.type)}
            onToggleHide={() => store.toggleModule(instance.id)}
            onRemove={() => store.removeModule(instance.id)}
            onDragStart={(e) => handleDragStart(index, e)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(index, e)}
            onDragEnd={handleDragEnd}
          />
        {/each}
      </div>

      <div class="editor__thread">
        <div class="editor__thread-line"></div>
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
          <Button variant="primary">Exporter</Button>
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
