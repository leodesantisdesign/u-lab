<script lang="ts">
  import { onMount } from 'svelte';
  import Select from './Select.svelte';
  import Button from './Button.svelte';

  type ImageFormat = 'png' | 'jpeg' | 'webp';

  interface ExportResult {
    width: number;
    height: number;
    bytes: number;
  }

  interface Props {
    format: { ratio: string; width: number; height: number };
    duration: number;
    fps: number;
    onClose: () => void;
    onExport: (options: { format: ImageFormat }) => Promise<ExportResult>;
  }

  let { format, duration, fps, onClose, onExport }: Props = $props();

  type Tab = 'image' | 'video';

  const QUALITIES: { value: string; label: string; longEdge: number }[] = [
    { value: 'basse', label: 'Basse', longEdge: 768 },
    { value: 'moyenne', label: 'Moyenne', longEdge: 1080 },
    { value: 'haute', label: 'Haute', longEdge: 1536 },
    { value: '4k', label: '4K', longEdge: 3840 },
  ];

  const IMAGE_FORMATS = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' },
  ];

  const VIDEO_FORMATS = [
    { value: 'h264', label: 'H.264' },
    { value: 'webm', label: 'WebM (VP9)' },
  ];

  // Octets par pixel : estimation grossière pour une image photographique compressée.
  const IMAGE_BYTES_PER_PIXEL: Record<string, number> = {
    png: 2.2,
    jpeg: 0.35,
    webp: 0.28,
  };

  // Débit par défaut (Mbps) suggéré par palier de qualité — point de départ, modifiable.
  const DEFAULT_BITRATE_MBPS: Record<string, number> = {
    basse: 2,
    moyenne: 8,
    haute: 20,
    '4k': 45,
  };

  let activeTab: Tab = $state('image');
  let qualityValue = $state('haute');
  let imageFormat: ImageFormat = $state('png');
  let videoFormat = $state('h264');
  let bitrateMbps = $state(DEFAULT_BITRATE_MBPS.haute);
  let exportFps = $state(fps);
  let exportDuration = $state(duration);

  let modalEl: HTMLDivElement | undefined = $state();
  let firstTabEl: HTMLButtonElement | undefined = $state();

  // L'export vidéo n'existe pas avant l'étape 4 — l'onglet reste désactivé
  // quelle que soit la source, pas seulement pour les sources animées.
  function selectTab(tab: Tab) {
    if (tab === 'video') return;
    activeTab = tab;
  }

  function handleImageFormatChange(next: string) {
    imageFormat = next as ImageFormat;
    lastResult = null; // le dernier résultat mesuré ne correspond plus au réglage courant
  }

  // Image : toujours la taille du document, jamais un palier de qualité —
  // « jamais en agrandissant l'aperçu » (ETAPE-2.md §3.6). Le palier de
  // qualité ne s'applique qu'à la vidéo, où un choix de résolution a un sens.
  // Vidéo : le palier fixe le grand côté en pixels, l'autre côté suit le
  // ratio du document, arrondi au pair (contrainte codecs).
  const outputSize = $derived.by(() => {
    if (activeTab === 'image') return { width: format.width, height: format.height };
    const longEdge = QUALITIES.find((q) => q.value === qualityValue)?.longEdge ?? format.width;
    const aspect = format.width / format.height;
    if (aspect >= 1) {
      const width = longEdge;
      const height = Math.max(2, Math.round(longEdge / aspect / 2) * 2);
      return { width, height };
    }
    const height = longEdge;
    const width = Math.max(2, Math.round((longEdge * aspect) / 2) * 2);
    return { width, height };
  });

  const activeFormatLabel = $derived(
    activeTab === 'image'
      ? (IMAGE_FORMATS.find((f) => f.value === imageFormat)?.label ?? imageFormat)
      : (VIDEO_FORMATS.find((f) => f.value === videoFormat)?.label ?? videoFormat),
  );

  const estimatedBytes = $derived(
    activeTab === 'image'
      ? outputSize.width * outputSize.height * (IMAGE_BYTES_PER_PIXEL[imageFormat] ?? 1)
      : ((bitrateMbps * 1_000_000) / 8) * Math.max(exportDuration, 0),
  );

  // Le « ~ » est le marqueur d'estimation : il disparaît devant un poids
  // mesuré sur le blob réel — sinon la ligne reste honnête en apparence
  // seulement, ce qu'on essaie justement d'éviter ici.
  function formatSize(bytes: number, exact = false): string {
    const mo = bytes / 1_000_000;
    if (mo < 0.1) return '< 0,1 Mo';
    const value = mo.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return exact ? `${value} Mo` : `~${value} Mo`;
  }

  let exportBusy = $state(false);
  let exportError: string | null = $state(null);
  let lastResult: ExportResult | null = $state(null);

  // Tant qu'aucun export n'a eu lieu (ou que les réglages ont changé depuis),
  // la ligne reste une estimation. Une fois le blob réel obtenu, elle
  // affiche ses vraies dimensions et son vrai poids — plus une estimation.
  const showsRealResult = $derived(
    activeTab === 'image' &&
      lastResult !== null &&
      lastResult.width === outputSize.width &&
      lastResult.height === outputSize.height,
  );

  const infoLine = $derived(
    showsRealResult && lastResult
      ? `Résolution ${lastResult.width} × ${lastResult.height} · ${formatSize(lastResult.bytes, true)} · ${activeFormatLabel}`
      : `Résolution ${outputSize.width} × ${outputSize.height} · ${formatSize(estimatedBytes)} · ${activeFormatLabel}`,
  );

  async function handleDownload() {
    if (activeTab !== 'image' || exportBusy) return;
    exportBusy = true;
    exportError = null;
    try {
      lastResult = await onExport({ format: imageFormat });
    } catch (err) {
      exportError = err instanceof Error ? err.message : "Échec de l'export.";
    } finally {
      exportBusy = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !modalEl) return;
    const focusables = modalEl.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    firstTabEl?.focus();
  });
</script>

<div class="export-modal__backdrop" onclick={onClose}>
  <div
    class="export-modal"
    bind:this={modalEl}
    role="dialog"
    aria-modal="true"
    aria-label="Exporter"
    onclick={(event) => event.stopPropagation()}
    onkeydown={handleKeydown}
  >
    <header class="export-modal__header">
      <h2 class="export-modal__title">Exporter</h2>
      <button class="export-modal__close" onclick={onClose} aria-label="Fermer">✕</button>
    </header>

    <div class="export-modal__tabs" role="tablist">
      <button
        bind:this={firstTabEl}
        class="export-modal__tab"
        class:export-modal__tab--active={activeTab === 'image'}
        role="tab"
        aria-selected={activeTab === 'image'}
        onclick={() => selectTab('image')}
      >
        Image
      </button>
      <button
        class="export-modal__tab"
        class:export-modal__tab--active={activeTab === 'video'}
        role="tab"
        aria-selected={activeTab === 'video'}
        disabled
        title="disponible à l'étape 4"
        onclick={() => selectTab('video')}
      >
        Vidéo
      </button>
    </div>

    <div class="export-modal__body">
      {#if activeTab === 'video'}
        <div class="export-modal__field">
          <span class="export-modal__field-label">Qualité</span>
          <Select
            label="Qualité"
            options={QUALITIES.map((q) => ({ label: q.label, value: q.value }))}
            bind:value={qualityValue}
          />
        </div>
      {/if}

      <div class="export-modal__row">
        <div class="export-modal__field">
          <span class="export-modal__field-label">Format</span>
          {#if activeTab === 'image'}
            <Select
              label="Format"
              options={IMAGE_FORMATS}
              bind:value={() => imageFormat, handleImageFormatChange}
            />
          {:else}
            <Select label="Format" options={VIDEO_FORMATS} bind:value={videoFormat} />
          {/if}
        </div>

        {#if activeTab === 'video'}
          <div class="export-modal__field">
            <span class="export-modal__field-label">Débit</span>
            <div class="export-modal__number">
              <input
                type="number"
                min="0.5"
                step="0.5"
                bind:value={bitrateMbps}
                aria-label="Débit en mégabits par seconde"
              />
              <span class="export-modal__unit">Mbps</span>
            </div>
          </div>

          <div class="export-modal__field">
            <span class="export-modal__field-label">Images par seconde</span>
            <div class="export-modal__number">
              <input
                type="number"
                min="1"
                max="120"
                step="1"
                bind:value={exportFps}
                aria-label="Images par seconde"
              />
              <span class="export-modal__unit">i/s</span>
            </div>
          </div>

          <div class="export-modal__field">
            <span class="export-modal__field-label">Durée</span>
            <div class="export-modal__number">
              <input
                type="number"
                min="0"
                step="0.1"
                bind:value={exportDuration}
                aria-label="Durée en secondes"
              />
              <span class="export-modal__unit">s</span>
            </div>
          </div>
        {/if}
      </div>

      <p class="export-modal__info">{infoLine}</p>
      {#if exportError}
        <p class="export-modal__error" role="alert">{exportError}</p>
      {/if}
    </div>

    <footer class="export-modal__footer">
      {#if activeTab === 'image'}
        <Button
          variant="primary"
          disabled={exportBusy}
          aria-busy={exportBusy}
          onclick={handleDownload}
        >
          {exportBusy ? 'Export en cours…' : 'Télécharger'}
        </Button>
      {:else}
        <Button variant="primary" disabled title="disponible à l'étape 4">Télécharger</Button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .export-modal__backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--backdrop);
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .export-modal {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    width: var(--modal-width-sm);
    max-width: calc(100vw - var(--space-24) * 2);
    max-height: calc(100vh - var(--space-24) * 2);
    background: var(--bg-1);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: var(--shadow);
    padding: var(--space-16);
    overflow: hidden;
    animation: modal-in var(--dur) var(--ease);
  }

  .export-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .export-modal__title {
    font-family: var(--font-sans);
    font-size: var(--t-h4);
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  .export-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--space-20);
    height: var(--space-20);
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease);
  }

  .export-modal__close:hover {
    color: var(--ink);
  }

  .export-modal__close:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .export-modal__tabs {
    display: flex;
    gap: var(--space-16);
    border-bottom: 1px solid var(--line);
    flex-shrink: 0;
  }

  .export-modal__tab {
    padding: var(--space-10) 0;
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--ink-muted);
    cursor: pointer;
    transition: color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
  }

  .export-modal__tab:hover:not(:disabled) {
    color: var(--ink);
  }

  .export-modal__tab:focus-visible {
    outline: 2px solid var(--ink-muted);
    outline-offset: var(--focus-offset);
  }

  .export-modal__tab--active {
    color: var(--ink);
    border-bottom-color: var(--ink);
  }

  .export-modal__tab:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .export-modal__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    overflow-y: auto;
  }

  .export-modal__row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-16);
  }

  .export-modal__field {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    flex: 1;
    min-width: 110px;
  }

  .export-modal__field-label {
    font-family: var(--font-sans);
    font-size: var(--t-label);
    color: var(--ink-muted);
  }

  .export-modal__number {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: var(--control-height);
    background: color-mix(in srgb, var(--bg-2) 30%, transparent);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 0 var(--space-10);
    transition: border-color var(--dur-fast) var(--ease);
  }

  .export-modal__number:focus-within {
    border-color: var(--ink-faint);
  }

  .export-modal__number input {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    font-variant-numeric: tabular-nums;
  }

  .export-modal__number input:focus-visible {
    outline: none;
  }

  .export-modal__number input::-webkit-outer-spin-button,
  .export-modal__number input::-webkit-inner-spin-button {
    margin: 0;
  }

  .export-modal__unit {
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: var(--t-label);
    color: var(--ink-faint);
  }

  .export-modal__info {
    font-family: var(--font-mono);
    font-size: var(--t-sm);
    color: var(--ink-muted);
    margin: 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }

  .export-modal__error {
    font-family: var(--font-sans);
    font-size: var(--t-sm);
    color: var(--danger);
    margin: 0;
  }

  .export-modal__footer {
    flex-shrink: 0;
  }

  .export-modal__footer :global(.btn) {
    width: 100%;
  }
</style>
