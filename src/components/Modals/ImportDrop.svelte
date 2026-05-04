<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { parseZip } from '../../lib/io/import';
  import { loadFromImport, updateSong } from '../../lib/state/chartStore';
  import { putAudio } from '../../lib/storage/audioStore';
  import { CURRENT_ID } from '../../lib/storage/drafts';
  import { isOggFilename } from '../../lib/audio/decode';

  let dragOver = $state(false);
  // dragenter/dragleave bubble for every nested element transition; track depth so the overlay
  // doesn't flicker while the cursor moves between children.
  let dragDepth = 0;

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      await handleZip(file);
      return;
    }
    if (isOggFilename(lower)) {
      await handleOgg(file);
      return;
    }
    alert('Only .zip (mod) and .ogg (audio) files are accepted.');
  }

  async function handleZip(file: File) {
    try {
      const mod = await parseZip(file);
      // Persist audio bytes before mutating chart state — App.svelte's $effect picks up the new bytes
      // by re-reading IndexedDB after dirtyTick bumps.
      await putAudio({ id: CURRENT_ID, filename: mod.audio.filename, mime: mod.audio.mime, bytes: mod.audio.bytes });
      loadFromImport(mod);
      if (mod.warnings.length > 0) {
        console.warn('import warnings:', mod.warnings);
      }
    } catch (err: any) {
      alert(`Import failed: ${err?.message ?? err}`);
    }
  }

  async function handleOgg(file: File) {
    try {
      const bytes = await file.arrayBuffer();
      await putAudio({ id: CURRENT_ID, filename: file.name, mime: file.type || 'audio/ogg', bytes });
      // Update song.Audio so export uses the new filename. This also bumps dirtyTick → App reloads transport.
      updateSong({ Audio: file.name });
    } catch (err: any) {
      alert(`Audio import failed: ${err?.message ?? err}`);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth = 0;
    dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragDepth += 1;
    dragOver = true;
  }

  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragOver = false;
  }

  onMount(() => {
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
  });

  onDestroy(() => {
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
  });

  export function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) handleZip(f);
    };
    input.click();
  }

  export function pickAudio() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ogg,audio/ogg';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (!isOggFilename(f.name)) {
        alert('Only .ogg files are accepted.');
        return;
      }
      handleOgg(f);
    };
    input.click();
  }
</script>

{#if dragOver}
  <div class="overlay">
    <div class="message">Drop .zip (mod) or .ogg (audio)</div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(14, 15, 19, 0.85);
    display: grid;
    place-items: center;
    z-index: 100;
    pointer-events: none;
  }
  .message {
    border: 2px dashed var(--accent);
    padding: var(--sp-6) var(--sp-6);
    color: var(--accent);
    font-size: 14px;
    background: var(--bg-1);
  }
</style>
