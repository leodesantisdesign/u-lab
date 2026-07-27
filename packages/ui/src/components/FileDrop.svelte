<script lang="ts">
  interface Props {
    label: string;
    value: string | null;
    disabled?: boolean;
  }

  let { label, value = $bindable(), disabled = false }: Props = $props();

  let dragOver = $state(false);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!disabled) dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    if (disabled) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) value = file.name;
  }

  function handleChange(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) value = file.name;
  }
</script>

<div class="file-drop">
  <span class="file-drop__label">{label}</span>
  <label
    class="file-drop__zone"
    class:file-drop__zone--over={dragOver}
    class:file-drop__zone--disabled={disabled}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <input
      class="file-drop__input"
      type="file"
      aria-label={label}
      {disabled}
      onchange={handleChange}
    />
    <span class="file-drop__text">
      {#if value}
        {value}
      {:else}
        Glisser un fichier ici
      {/if}
    </span>
  </label>
</div>

<style>
  .file-drop {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
  }

  .file-drop__label {
    font-family: var(--font-sans);
    font-size: var(--t-base);
    font-weight: 400;
    color: var(--ink-muted);
  }

  .file-drop__zone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--dropzone-height);
    border: 1px dashed var(--line);
    border-radius: var(--r-lg);
    padding: var(--space-8);
    cursor: pointer;
    transition: border-color var(--dur-fast) var(--ease);
  }

  .file-drop__zone--over {
    border-color: var(--accent);
  }

  .file-drop__zone:focus-within {
    border-color: var(--ink-faint);
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .file-drop__zone--over:focus-within {
    border-color: var(--accent);
  }

  .file-drop__zone--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .file-drop__input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .file-drop__zone--disabled .file-drop__input {
    cursor: not-allowed;
  }

  .file-drop__text {
    max-width: 100%;
    padding: 0 var(--space-8);
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    color: var(--ink-muted);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
