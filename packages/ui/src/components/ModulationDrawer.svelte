<script lang="ts">
  import type { ModSource, Modulation } from '@ulab/core';
  import SliderRow from './SliderRow.svelte';
  import Select from './Select.svelte';

  type TargetOption = { moduleId: string; paramKey: string; label: string };

  interface Props {
    duration: number;
    fps: number;
    modulations: Modulation[];
    targetOptions: TargetOption[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onMove: (from: number, to: number) => void;
    onToggle: (id: string) => void;
    onTargetChange: (id: string, target: { moduleId: string; paramKey: string }) => void;
    onSourceChange: (id: string, source: ModSource) => void;
    onSensitivityChange: (id: string, sensitivity: number) => void;
    onRangeChange: (id: string, range: [number, number]) => void;
  }

  let {
    duration,
    fps,
    modulations,
    targetOptions,
    onAdd,
    onRemove,
    onMove,
    onToggle,
    onTargetChange,
    onSourceChange,
    onSensitivityChange,
    onRangeChange,
  }: Props = $props();

  const SOURCE_OPTIONS: { key: string; label: string; source: ModSource }[] = [
    { key: 'keyframes', label: 'Keyframes', source: { kind: 'keyframes', points: [] } },
    { key: 'video-luma', label: 'Luminance', source: { kind: 'video', signal: 'luma' } },
    { key: 'video-motion', label: 'Mouvement', source: { kind: 'video', signal: 'motion' } },
    { key: 'video-contrast', label: 'Contraste', source: { kind: 'video', signal: 'contrast' } },
    {
      key: 'audio-low',
      label: 'Audio (grave)',
      source: { kind: 'audio', band: 'low', smoothing: 0.5 },
    },
    {
      key: 'audio-mid',
      label: 'Audio (médium)',
      source: { kind: 'audio', band: 'mid', smoothing: 0.5 },
    },
    {
      key: 'audio-high',
      label: 'Audio (aigu)',
      source: { kind: 'audio', band: 'high', smoothing: 0.5 },
    },
    {
      key: 'audio-rms',
      label: 'Audio (niveau)',
      source: { kind: 'audio', band: 'rms', smoothing: 0.5 },
    },
  ];

  function sourceKey(source: ModSource): string {
    if (source.kind === 'keyframes') return 'keyframes';
    if (source.kind === 'video') return `video-${source.signal}`;
    return `audio-${source.band}`;
  }

  function encodeTarget(target: { moduleId: string; paramKey: string }): string {
    return `${target.moduleId}::${target.paramKey}`;
  }

  function decodeTarget(key: string): { moduleId: string; paramKey: string } {
    const [moduleId, paramKey] = key.split('::');
    return { moduleId: moduleId ?? '', paramKey: paramKey ?? '' };
  }

  function handleTargetChange(id: string, key: string) {
    onTargetChange(id, decodeTarget(key));
  }

  function handleSourceChange(id: string, key: string) {
    const option = SOURCE_OPTIONS.find((o) => o.key === key);
    if (option) onSourceChange(id, option.source);
  }

  function handleRangeMinChange(id: string, current: [number, number], raw: string) {
    onRangeChange(id, [Number(raw), current[1]]);
  }

  function handleRangeMaxChange(id: string, current: [number, number], raw: string) {
    onRangeChange(id, [current[0], Number(raw)]);
  }

  function formatTime(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const TICK_COUNT = 5;
  const ticks = $derived(
    duration > 0 ? Array.from({ length: TICK_COUNT + 1 }, (_, i) => (duration * i) / TICK_COUNT) : [0],
  );

  let expanded = $state(false);
  let playing = $state(false);

  function togglePlay() {
    playing = !playing;
  }

  function stop() {
    playing = false;
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
    onMove(draggedIndex, index);
    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }
</script>

<div class="modulation-drawer">
  <div class="modulation-drawer__bar">
    <span class="modulation-drawer__label">MODULATION &amp; AUTOMATISATIONS</span>
    <div class="modulation-drawer__transport">
      <button class="modulation-drawer__transport-btn" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Lecture'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button class="modulation-drawer__transport-btn" onclick={stop} aria-label="Stop">■</button>
      <span class="modulation-drawer__transport-time">00:00 / {formatTime(duration)}</span>
    </div>
    <button
      class="modulation-drawer__chevron"
      class:modulation-drawer__chevron--open={expanded}
      onclick={() => (expanded = !expanded)}
      aria-label={expanded ? 'Replier le tiroir de modulation' : 'Déplier le tiroir de modulation'}
      aria-expanded={expanded}
    >
      ⌄
    </button>
  </div>

  {#if expanded}
    <div class="modulation-drawer__body">
      <div class="modulation-drawer__table">
        {#each modulations as modulation, index (modulation.id)}
          <div
            class="modulation-drawer__row"
            class:modulation-drawer__row--dragging={draggedIndex === index}
            draggable={true}
            ondragstart={(e) => handleDragStart(index, e)}
            ondragover={handleDragOver}
            ondrop={(e) => handleDrop(index, e)}
            ondragend={handleDragEnd}
          >
            <div class="modulation-drawer__row-top">
              <span class="modulation-drawer__handle" aria-hidden="true">⠿</span>
              <button
                class="modulation-drawer__eye"
                onclick={() => onToggle(modulation.id)}
                aria-pressed={modulation.enabled}
                aria-label={modulation.enabled ? 'Désactiver cette modulation' : 'Activer cette modulation'}
              >
                {modulation.enabled ? '◉' : '○'}
              </button>
              <div class="modulation-drawer__target">
                <Select
                  label="Paramètre ciblé"
                  options={targetOptions.map((t) => ({ label: t.label, value: encodeTarget(t) }))}
                  bind:value={
                    () => encodeTarget(modulation.target),
                    (v) => handleTargetChange(modulation.id, v)
                  }
                />
              </div>
              <button
                class="modulation-drawer__remove"
                onclick={() => onRemove(modulation.id)}
                aria-label="Retirer cette modulation"
              >
                ✕
              </button>
            </div>
            <div class="modulation-drawer__row-bottom">
              <div class="modulation-drawer__source">
                <Select
                  label="Source de modulation"
                  options={SOURCE_OPTIONS.map((o) => ({ label: o.label, value: o.key }))}
                  bind:value={
                    () => sourceKey(modulation.source),
                    (v) => handleSourceChange(modulation.id, v)
                  }
                />
              </div>
              <div class="modulation-drawer__sensitivity">
                <SliderRow
                  label="Sensibilité"
                  min={0}
                  max={1}
                  step={0.01}
                  bind:value={
                    () => modulation.sensitivity,
                    (v) => onSensitivityChange(modulation.id, v)
                  }
                />
              </div>
              <div class="modulation-drawer__range">
                <input
                  class="modulation-drawer__range-input"
                  type="number"
                  step="0.01"
                  value={modulation.range[0]}
                  oninput={(e) =>
                    handleRangeMinChange(modulation.id, modulation.range, e.currentTarget.value)}
                  aria-label="Plage — minimum"
                />
                <span class="modulation-drawer__range-sep" aria-hidden="true">–</span>
                <input
                  class="modulation-drawer__range-input"
                  type="number"
                  step="0.01"
                  value={modulation.range[1]}
                  oninput={(e) =>
                    handleRangeMaxChange(modulation.id, modulation.range, e.currentTarget.value)}
                  aria-label="Plage — maximum"
                />
              </div>
            </div>
          </div>
        {/each}

        <button
          class="modulation-drawer__add"
          onclick={onAdd}
          disabled={targetOptions.length === 0}
        >
          + Ajouter une modulation
        </button>
      </div>

      <div class="modulation-drawer__timeline">
        <div class="modulation-drawer__playhead" style:left="0%"></div>
        <div class="modulation-drawer__ruler">
          {#each ticks as t, i (i)}
            <div class="modulation-drawer__tick" style:left="{(i / TICK_COUNT) * 100}%">
              <span class="modulation-drawer__tick-time">{formatTime(t)}</span>
              <span class="modulation-drawer__tick-frame">{Math.round(t * fps)}</span>
            </div>
          {/each}
        </div>
        {#each modulations as modulation (modulation.id)}
          <div class="modulation-drawer__track"></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .modulation-drawer {
    display: flex;
    flex-direction: column;
    background: var(--bg-1);
    border-top: 1px solid var(--line);
  }

  .modulation-drawer__bar {
    display: flex;
    align-items: center;
    height: var(--drawer-bar-height);
    flex-shrink: 0;
    padding: 0 var(--space-16);
    gap: var(--space-16);
  }

  .modulation-drawer__label {
    font-family: var(--font-sans);
    font-size: var(--t-label);
    font-weight: 500;
    letter-spacing: var(--tracking-label);
    color: var(--ink-muted);
    flex-shrink: 0;
  }

  .modulation-drawer__transport {
    display: flex;
    align-items: center;
    gap: var(--space-8);
    margin: 0 auto;
  }

  .modulation-drawer__transport-btn {
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

  .modulation-drawer__transport-btn:hover {
    color: var(--ink);
  }

  .modulation-drawer__transport-btn:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .modulation-drawer__transport-time {
    font-family: var(--font-mono);
    font-size: var(--t-micro);
    color: var(--ink-faint);
    font-variant-numeric: tabular-nums;
  }

  .modulation-drawer__chevron {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--ink-faint);
    cursor: pointer;
    transition: transform var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
  }

  .modulation-drawer__chevron:hover {
    color: var(--ink);
  }

  .modulation-drawer__chevron:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .modulation-drawer__chevron--open {
    transform: rotate(180deg);
  }

  .modulation-drawer__body {
    display: flex;
    gap: var(--space-16);
    height: max(40vh, var(--drawer-body-min-height));
    padding: var(--space-16);
    border-top: 1px solid var(--line);
    overflow-y: auto;
  }

  .modulation-drawer__table {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    flex: 0 0 420px;
    min-width: 0;
  }

  .modulation-drawer__row {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    height: var(--dropzone-height);
    flex-shrink: 0;
    padding: var(--space-8);
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    transition: box-shadow var(--dur-fast) var(--ease);
  }

  .modulation-drawer__row--dragging {
    box-shadow: var(--shadow);
  }

  .modulation-drawer__row-top,
  .modulation-drawer__row-bottom {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .modulation-drawer__handle {
    flex-shrink: 0;
    color: var(--ink-faint);
    cursor: grab;
  }

  .modulation-drawer__eye {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .modulation-drawer__eye:hover {
    color: var(--ink);
  }

  .modulation-drawer__eye:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .modulation-drawer__target {
    flex: 1;
    min-width: 0;
  }

  .modulation-drawer__target :global(.select) {
    width: 100%;
  }

  .modulation-drawer__remove {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .modulation-drawer__remove:hover {
    color: var(--danger);
  }

  .modulation-drawer__remove:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .modulation-drawer__source {
    flex-shrink: 0;
    width: 120px;
  }

  .modulation-drawer__source :global(.select) {
    width: 100%;
  }

  .modulation-drawer__sensitivity {
    flex: 1;
    min-width: 0;
  }

  .modulation-drawer__range {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .modulation-drawer__range-input {
    width: 48px;
    height: var(--control-height);
    background: color-mix(in srgb, var(--bg-1) 60%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 0 var(--space-4);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--t-sm);
  }

  .modulation-drawer__range-input:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .modulation-drawer__range-sep {
    color: var(--ink-faint);
  }

  .modulation-drawer__add {
    flex-shrink: 0;
    padding: var(--space-8);
    background: transparent;
    border: 1px dashed var(--line);
    border-radius: var(--r-lg);
    color: var(--ink-muted);
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
  }

  .modulation-drawer__add:hover:not(:disabled) {
    border-color: var(--ink-faint);
    color: var(--ink);
  }

  .modulation-drawer__add:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .modulation-drawer__timeline {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    flex: 1;
    min-width: 0;
  }

  .modulation-drawer__ruler {
    position: relative;
    height: 32px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--line);
  }

  .modulation-drawer__tick {
    position: absolute;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .modulation-drawer__tick-time {
    font-family: var(--font-mono);
    font-size: var(--t-micro);
    color: var(--ink-faint);
  }

  .modulation-drawer__tick-frame {
    font-family: var(--font-mono);
    font-size: var(--t-micro);
    color: var(--ink-faint);
    opacity: 0.6;
  }

  .modulation-drawer__playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    z-index: 1;
    background: var(--accent);
    pointer-events: none;
  }

  .modulation-drawer__track {
    height: var(--dropzone-height);
    flex-shrink: 0;
    background: color-mix(in srgb, var(--bg-2) 50%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
  }
</style>
