<script lang="ts">
  import { chart } from '../../lib/state/chartStore';
  import { buildZip, downloadBlob, downloadText, downloadBytes, sanitizeFolderName, stringifySong, stringifyLevel } from '../../lib/io/export';
  import { getAudio } from '../../lib/storage/audioStore';
  import { CURRENT_ID } from '../../lib/storage/drafts';
  import { validateForExport, type ValidationIssue } from '../../lib/io/validate';

  interface Props {
    open: boolean;
    onClose: () => void;
  }
  const { open, onClose }: Props = $props();

  let folderName = $state('');
  let busy = $state(false);
  let lastIssues = $state<ValidationIssue[]>([]);

  $effect(() => {
    if (open) {
      folderName = sanitizeFolderName($chart.song.ID || 'mod');
      lastIssues = validateForExport($chart.song, new Map(Object.entries($chart.levels)), true);
    }
  });

  async function exportZip() {
    busy = true;
    try {
      const audio = await getAudio(CURRENT_ID).catch(() => undefined);
      const result = await buildZip({
        song: $chart.song,
        levels: new Map(Object.entries($chart.levels)),
        audio: audio ? { filename: audio.filename, bytes: audio.bytes } : null,
        modFolderName: sanitizeFolderName(folderName),
      });
      if (!result.ok) {
        lastIssues = result.issues;
        return;
      }
      downloadBlob(result.blob, result.filename);
      onClose();
    } finally {
      busy = false;
    }
  }

  function exportSongJson() {
    downloadText(stringifySong($chart.song), 'song.json');
  }

  function exportLevelJson(path: string) {
    const lvl = $chart.levels[path];
    if (!lvl) return;
    downloadText(stringifyLevel(lvl), path);
  }

  async function exportAudio() {
    const audio = await getAudio(CURRENT_ID).catch(() => undefined);
    if (!audio) {
      alert('No audio loaded.');
      return;
    }
    downloadBytes(audio.bytes, audio.filename, audio.mime);
  }

  const errors = $derived(lastIssues.filter((i) => i.severity === 'error'));
  const uniqueLevelPaths = $derived.by(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ref of $chart.song.Levels) {
      if (!seen.has(ref.Path)) {
        seen.add(ref.Path);
        out.push(ref.Path);
      }
    }
    return out;
  });
</script>

{#if open}
  <div
    class="backdrop"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
  >
    <div
      class="dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <header>
        <h3>Export</h3>
        <button class="close" onclick={onClose}>×</button>
      </header>

      <section>
        <label>
          <span>Mod folder name</span>
          <input type="text" bind:value={folderName} />
        </label>

        {#if errors.length > 0}
          <div class="errors">
            <strong>Cannot export — fix these:</strong>
            <ul>
              {#each errors as e}
                <li>{e.message}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <button class="primary" onclick={exportZip} disabled={busy || errors.length > 0}>
          {busy ? 'Building…' : 'Download .zip'}
        </button>
      </section>

      <section>
        <h4>Individual files</h4>
        <div class="grid">
          <button onclick={exportSongJson}>song.json</button>
          {#each uniqueLevelPaths as p}
            <button onclick={() => exportLevelJson(p)}>{p}</button>
          {/each}
          <button onclick={exportAudio}>audio (.ogg)</button>
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .dialog {
    background: var(--bg-1);
    border: var(--hairline);
    padding: var(--sp-4);
    width: 420px;
    max-width: 90vw;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--fg-dim);
  }
  .close {
    background: transparent;
    border: none;
    color: var(--fg-mute);
    font-size: 18px;
    cursor: pointer;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    border-top: var(--hairline-soft);
    padding-top: var(--sp-2);
  }
  section:first-of-type {
    border-top: none;
    padding-top: 0;
  }
  h4 {
    margin: 0;
    font-size: 11px;
    color: var(--fg-mute);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  label {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
  label span {
    font-size: 11px;
    color: var(--fg-dim);
  }
  input {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 4px 6px;
    border-radius: 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  button {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 4px 8px;
    border-radius: 2px;
    cursor: pointer;
  }
  button:hover {
    background: var(--bg-3);
  }
  button.primary {
    background: var(--accent);
    color: var(--bg-0);
    border-color: var(--accent);
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent-dim);
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .errors {
    background: rgba(255, 107, 107, 0.08);
    border: 1px solid var(--error);
    padding: var(--sp-2);
    border-radius: 2px;
    font-size: 11px;
    color: var(--error);
  }
  .errors ul {
    margin: 4px 0 0;
    padding-left: var(--sp-3);
    color: var(--fg);
  }
</style>
