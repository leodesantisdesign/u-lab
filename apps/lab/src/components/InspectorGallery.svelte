<script lang="ts">
  import { all } from '@ulab/modules';
  import type { ModuleDef } from '@ulab/modules';
  import type { ModuleInstance } from '@ulab/core';
  import Inspector from '@ulab/ui/components/Inspector.svelte';
  import SectionLabel from '@ulab/ui/components/SectionLabel.svelte';

  const modules = all();

  function createInstance(def: ModuleDef): ModuleInstance {
    const params: ModuleInstance['params'] = {};
    for (const param of def.params) {
      params[param.key] = param.default;
    }
    return {
      id: def.type,
      type: def.type,
      enabled: true,
      params,
      blend: { mode: 'normal', opacity: 1 },
    };
  }

  const instances: Record<string, ModuleInstance> = $state(
    Object.fromEntries(modules.map((def) => [def.type, createInstance(def)])),
  );

  function resetInstance(def: ModuleDef) {
    instances[def.type] = createInstance(def);
  }
</script>

{#snippet moduleIcon()}
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
    <rect width="8" height="8" fill="currentColor" />
  </svg>
{/snippet}

<section class="gallery">
  <SectionLabel text="Inspecteur — un par module du registre" />
  <div class="gallery__grid">
    {#each modules as def (def.type)}
      <div class="gallery__cell">
        <p class="gallery__type">{def.type}</p>
        <Inspector {def} instance={instances[def.type]} icon={moduleIcon} onReset={() => resetInstance(def)} />
      </div>
    {/each}
  </div>
</section>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-24);
    max-width: 1200px;
    margin: 0 auto;
  }

  .gallery__grid {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-24);
  }

  .gallery__cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .gallery__type {
    font-family: var(--font-mono);
    font-size: var(--t-micro);
    color: var(--ink-faint);
  }
</style>
