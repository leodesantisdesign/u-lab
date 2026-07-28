<script lang="ts">
  interface Props {
    label: string;
    /** Nom du média actuellement référencé, déjà résolu par l'appelant — FileDrop ne lit jamais le document. */
    mediaName?: string | null;
    /** Message de refus (fichier non-image, trop lourd…), décidé par l'appelant. */
    error?: string | null;
    disabled?: boolean;
    onFile?: (file: File) => void;
  }

  let { label, mediaName = null, error = null, disabled = false, onFile }: Props = $props();

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
    if (file) onFile?.(file);
  }

  function handleChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onFile?.(file);
    input.value = ''; // permet de re-choisir le même fichier après un refus
  }
</script>

<div class="file-drop">
  <span class="file-drop__label">{label}</span>
  <label
    class="file-drop__zone"
    class:file-drop__zone--over={dragOver}
    class:file-drop__zone--disabled={disabled}
    class:file-drop__zone--error={Boolean(error)}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    <input
      class="file-drop__input"
      type="file"
      accept="image/*"
      aria-label={label}
      {disabled}
      onchange={handleChange}
    />
    <span class="file-drop__text">
      {#if mediaName}
        {mediaName}
      {:else}
        Glisser un fichier ici
      {/if}
    </span>
  </label>
  {#if error}
    <span class="file-drop__error" role="alert">{error}</span>
  {/if}
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

  .file-drop__zone--error {
    border-color: var(--danger);
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

  .file-drop__error {
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--danger);
  }
</style>
