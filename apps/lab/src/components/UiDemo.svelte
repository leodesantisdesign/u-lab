<script lang="ts">
  import SectionLabel from '@ulab/ui/components/SectionLabel.svelte';
  import SliderRow from '@ulab/ui/components/SliderRow.svelte';
  import Select from '@ulab/ui/components/Select.svelte';
  import Button from '@ulab/ui/components/Button.svelte';
  import Panel from '@ulab/ui/components/Panel.svelte';
  import StackItem from '@ulab/ui/components/StackItem.svelte';
  import PreviewFrame from '@ulab/ui/components/PreviewFrame.svelte';

  let sliderValue = $state(42);
  let sliderMin = $state(0);
  let sliderMax = $state(100);

  let selectValue = $state('bayer4');
  const selectOptions = [
    { label: 'Bayer 4×4', value: 'bayer4' },
    { label: 'Bayer 8×8', value: 'bayer8' },
    { label: 'Bruit bleu', value: 'blue-noise' },
  ];

  const stackItems = $state([
    { id: 'source', name: 'Source' },
    { id: 'bayer4', name: 'Bayer 4×4' },
    { id: 'palette', name: 'Palette' },
  ]);
  let selectedStackId = $state('bayer4');

  let hiddenStackIds = $state(new Set<string>());

  function toggleStackHidden(id: string) {
    const next = new Set(hiddenStackIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    hiddenStackIds = next;
  }
</script>

{#snippet iconDot()}
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
    <circle cx="4" cy="4" r="4" fill="currentColor" />
  </svg>
{/snippet}

<div class="demo">
  <section class="demo__block">
    <SectionLabel text="Libellés de section" />
    <div class="demo__row">
      <SectionLabel text="Réglages" />
      <SectionLabel text="Palette" />
      <SectionLabel text="Finition" />
    </div>
  </section>

  <section class="demo__block">
    <SectionLabel text="Ligne de réglage" />
    <div class="demo__stack-vertical">
      <SliderRow label="Seuil" bind:value={sliderValue} min={0} max={100} unit="%" />
      <SliderRow label="Valeur au minimum" bind:value={sliderMin} min={0} max={100} unit="%" />
      <SliderRow label="Valeur au maximum" bind:value={sliderMax} min={0} max={100} unit="%" />
      <SliderRow label="Désactivé" value={30} min={0} max={100} unit="%" disabled />
    </div>
  </section>

  <section class="demo__block">
    <SectionLabel text="Select" />
    <div class="demo__row">
      <Select label="Motif de tramage" options={selectOptions} bind:value={selectValue} />
      <Select label="Désactivé" options={selectOptions} value="bayer4" disabled />
    </div>
  </section>

  <section class="demo__block">
    <SectionLabel text="Boutons" />
    <div class="demo__row">
      <Button variant="primary">Exporter</Button>
      <Button variant="secondary">Réinitialiser</Button>
      <Button variant="ghost">Annuler</Button>
    </div>
    <div class="demo__row">
      <Button variant="primary" disabled>Exporter</Button>
      <Button variant="secondary" disabled>Réinitialiser</Button>
      <Button variant="ghost" disabled>Annuler</Button>
    </div>
  </section>

  <section class="demo__block">
    <SectionLabel text="Panel" />
    <Panel>
      <SectionLabel text="Réglages" />
      <SliderRow label="Intensité" value={60} min={0} max={100} unit="%" />
      <Select label="Motif" options={selectOptions} value={selectValue} />
    </Panel>
  </section>

  <section class="demo__block">
    <SectionLabel text="Élément de pile" />
    <div class="demo__stack-vertical" style:width="var(--stack-width)">
      {#each stackItems as item (item.id)}
        <StackItem
          icon={iconDot}
          name={item.name}
          selected={selectedStackId === item.id}
          hidden={hiddenStackIds.has(item.id)}
          draggable={true}
          onSelect={() => (selectedStackId = item.id)}
          onChange={() => alert(`Changer ${item.name}`)}
          onToggleHide={() => toggleStackHidden(item.id)}
          onRemove={() => alert(`Retirer ${item.name}`)}
        />
      {/each}
    </div>
  </section>

  <section class="demo__block">
    <SectionLabel text="Cadre d'aperçu" />
    <div class="demo__row demo__row--wrap">
      <div class="demo__preview-wrap">
        <PreviewFrame ratio="1:1" width={512} height={512}>
          {#snippet children()}
            <div class="demo__swatch"></div>
          {/snippet}
        </PreviewFrame>
      </div>
      <div class="demo__preview-wrap">
        <PreviewFrame ratio="16:9" width={1280} height={720} />
      </div>
    </div>
  </section>
</div>

<style>
  .demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-24);
    padding: var(--space-24);
    max-width: 960px;
    margin: 0 auto;
  }

  .demo__block {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    padding-bottom: var(--space-24);
    border-bottom: 1px solid var(--line);
  }

  .demo__row {
    display: flex;
    align-items: center;
    gap: var(--space-16);
  }

  .demo__row--wrap {
    flex-wrap: wrap;
  }

  .demo__stack-vertical {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .demo__preview-wrap {
    width: 320px;
    height: 220px;
  }

  .demo__preview-wrap :global(.preview-frame) {
    width: 100%;
    height: 100%;
  }

  .demo__swatch {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--accent), var(--ink-faint));
  }
</style>
