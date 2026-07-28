<script lang="ts">
  import type { ParamDef } from '@ulab/modules';
  import type { ParamValue } from '@ulab/core';
  import SliderRow from './SliderRow.svelte';
  import Select from './Select.svelte';
  import Switch from './Switch.svelte';
  import ColorField from './ColorField.svelte';
  import PointField from './PointField.svelte';
  import TextArea from './TextArea.svelte';
  import FileDrop from './FileDrop.svelte';

  interface Props {
    param: ParamDef;
    value: ParamValue;
    disabled?: boolean;
    /** Paramètre 'file' uniquement — transmis tel quel, résolu par l'appelant. */
    mediaName?: string | null;
    fileError?: string | null;
    onFile?: (file: File) => void;
  }

  let {
    param,
    value = $bindable(),
    disabled = false,
    mediaName = null,
    fileError = null,
    onFile,
  }: Props = $props();

  function setValue(next: ParamValue) {
    value = next;
  }

  function asNumber(fallback: number): number {
    return typeof value === 'number' ? value : fallback;
  }

  function asString(fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }

  function asBoolean(fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  function asPoint(fallback: { x: number; y: number }): { x: number; y: number } {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : fallback;
  }
</script>

{#if param.type === 'number'}
  <SliderRow
    label={param.label}
    bind:value={() => asNumber(param.default), setValue}
    min={param.min}
    max={param.max}
    step={param.step}
    unit={param.unit ?? ''}
    {disabled}
  />
{:else if param.type === 'enum'}
  <Select
    label={param.label}
    options={param.options.map((option) => ({ label: option, value: option }))}
    bind:value={() => asString(param.default), setValue}
    {disabled}
  />
{:else if param.type === 'boolean'}
  <Switch label={param.label} bind:value={() => asBoolean(param.default), setValue} {disabled} />
{:else if param.type === 'color'}
  <ColorField label={param.label} bind:value={() => asString(param.default), setValue} {disabled} />
{:else if param.type === 'point'}
  <PointField label={param.label} bind:value={() => asPoint(param.default), setValue} {disabled} />
{:else if param.type === 'text'}
  <TextArea label={param.label} bind:value={() => asString(param.default), setValue} {disabled} />
{:else if param.type === 'file'}
  <FileDrop label={param.label} {mediaName} error={fileError} {disabled} {onFile} />
{/if}
