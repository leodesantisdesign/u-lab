<script lang="ts">
  import { all, byName } from '@ulab/palette';
  import Select from './Select.svelte';

  interface Props {
    label: string;
    value: string;
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();

  const options = all().map((palette) => ({ label: palette.label, value: palette.name }));

  // Bande d'échantillons de la palette SÉLECTIONNÉE — purement illustratif,
  // le nom de la palette (porté par le Select) suffit à un lecteur d'écran.
  const swatches = $derived(byName(value)?.colors ?? []);
</script>

<div class="palette-field">
  <Select {label} {options} bind:value {disabled} />
  {#if swatches.length > 0}
    <div class="palette-field__swatches" class:palette-field__swatches--disabled={disabled} aria-hidden="true">
      {#each swatches as hex (hex)}
        <span class="palette-field__swatch" style:background={hex}></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .palette-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .palette-field__swatches {
    display: flex;
    height: var(--space-16);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    overflow: hidden;
  }

  .palette-field__swatches--disabled {
    opacity: 0.5;
  }

  .palette-field__swatch {
    flex: 1;
  }
</style>
