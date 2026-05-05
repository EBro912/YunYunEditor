<script lang="ts">
  import { onMount } from 'svelte';
  import {
    listDrafts,
    upsertDraftMeta,
    deleteDraft,
    readDraft,
    writeDraft,
    newDraftId,
    reassignNoteIds,
    DRAFT_LIMIT,
    CURRENT_ID,
    type DraftMeta,
  } from '../../lib/storage/drafts';
  import { get } from 'svelte/store';
  import { chart, loadFromImport, dirty, markClean } from '../../lib/state/chartStore';
  import { putAudio, getAudio, deleteAudio } from '../../lib/storage/audioStore';
  import { clearHistory } from '../../lib/state/history';
  import type { ImportedMod } from '../../lib/io/import';

  let drafts = $state<DraftMeta[]>([]);
  let nameField = $state('');

  function refresh() {
    drafts = listDrafts();
  }

  onMount(refresh);

  async function saveAs() {
    if (drafts.length >= DRAFT_LIMIT) {
      alert(`Draft limit (${DRAFT_LIMIT}) reached. Delete a draft first.`);
      return;
    }
    const name = nameField.trim() || `Draft ${drafts.length + 1}`;
    const id = newDraftId();
    const c = $chart;
    // Copy audio FIRST. If the audio write fails we don't want a draft entry pointing at missing
    // bytes — bail before writing chart metadata. On success the draft is fully populated.
    try {
      const cur = await getAudio(CURRENT_ID);
      if (cur) await putAudio({ ...cur, id });
    } catch (err: any) {
      alert(`Save draft failed (audio): ${err?.message ?? err}`);
      return;
    }
    try {
      writeDraft(id, { song: c.song, levels: c.levels });
      upsertDraftMeta({ id, name, updatedAt: Date.now(), songId: c.song.ID });
    } catch (err: any) {
      // Roll back everything written under this id. writeDraft may have already persisted the
      // body before upsertDraftMeta threw — without this the body would orphan in localStorage,
      // unlisted in the panel and unrecoverable through the UI. deleteDraft is a no-op for keys
      // that were never written, so it's safe regardless of which step failed.
      await deleteDraft(id).catch(() => undefined);
      alert(`Save draft failed: ${err?.message ?? err}`);
      return;
    }
    nameField = '';
    // Current work is now preserved in a named draft, so it can be safely overwritten on next load.
    markClean();
    refresh();
  }

  async function load(id: string) {
    if (get(dirty)) {
      const ok = confirm(
        'Loading this draft will overwrite your current unsaved work. Continue?',
      );
      if (!ok) return;
    }
    const d = readDraft(id);
    if (!d) return;
    let audio: Awaited<ReturnType<typeof getAudio>>;
    try {
      audio = await getAudio(id);
    } catch (err: any) {
      alert(`Load draft failed (audio read): ${err?.message ?? err}`);
      return;
    }
    // Mirror the named draft's audio into CURRENT_ID before swapping chart state. App.svelte's
    // audio-rehydrate $effect reads from CURRENT_ID and dedupes by filename + byteLength;
    // without this copy it sees the previously-loaded draft's bytes and skips reload. Surface
    // failures — silently leaving stale CURRENT_ID audio would pair the new chart with old audio.
    try {
      if (audio) {
        await putAudio({ ...audio, id: CURRENT_ID });
      } else {
        await deleteAudio(CURRENT_ID);
      }
    } catch (err: any) {
      alert(`Load draft failed (audio swap): ${err?.message ?? err}`);
      return;
    }
    const mod: ImportedMod = {
      song: d.song,
      levels: new Map(Object.entries(d.levels)),
      audio: audio ?? { filename: d.song.Audio || 'audio.ogg', mime: 'audio/ogg', bytes: new ArrayBuffer(0) },
      modFolderName: d.song.ID || 'mod',
      warnings: [],
    };
    reassignNoteIds(d);
    loadFromImport(mod);
    // Loading a draft replaces both chart and audio — old history entries refer to the previous
    // project's audio, which we just overwrote in IDB. Drop them to keep undo coherent.
    clearHistory();
  }

  async function remove(id: string) {
    if (!confirm('Delete this draft?')) return;
    await deleteDraft(id);
    refresh();
  }

  function fmtTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString();
  }
</script>

<div class="save-row">
  <input type="text" placeholder="Save current as…" bind:value={nameField} />
  <button onclick={saveAs}>Save</button>
</div>

<ul class="drafts">
  {#each drafts as d (d.id)}
    <li>
      <button class="row" onclick={() => load(d.id)}>
        <span class="name">{d.name}</span>
        <span class="when mono">{fmtTime(d.updatedAt)}</span>
      </button>
      <button class="rm mini" onclick={() => remove(d.id)} title="delete">✕</button>
    </li>
  {:else}
    <li class="empty">No saved drafts yet.</li>
  {/each}
</ul>

<style>
  .save-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px;
    margin-bottom: var(--sp-2);
  }
  input {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 3px 6px;
    border-radius: 2px;
  }
  button {
    background: var(--bg-3);
    border: var(--hairline);
    color: var(--fg);
    padding: 3px 8px;
    cursor: pointer;
    border-radius: 2px;
  }
  .drafts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .drafts li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px;
  }
  .row {
    display: flex;
    flex-direction: column;
    text-align: left;
    background: var(--bg-2);
    border: var(--hairline-soft);
    padding: 4px 6px;
    cursor: pointer;
  }
  .row:hover {
    background: var(--bg-3);
  }
  .name {
    font-size: 12px;
  }
  .when {
    font-size: 10px;
    color: var(--fg-mute);
  }
  .mini {
    background: transparent;
    border: var(--hairline-soft);
    color: var(--fg-dim);
  }
  .empty {
    color: var(--fg-mute);
    font-size: 11px;
  }
</style>
