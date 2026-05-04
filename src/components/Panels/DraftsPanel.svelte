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
  import { chart, loadFromImport } from '../../lib/state/chartStore';
  import { putAudio, getAudio, deleteAudio } from '../../lib/storage/audioStore';
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
    writeDraft(id, { song: c.song, levels: c.levels });
    upsertDraftMeta({ id, name, updatedAt: Date.now(), songId: c.song.ID });
    // Copy current audio (under the special "current" key) into the named draft.
    const cur = await getAudio(CURRENT_ID).catch(() => undefined);
    if (cur) await putAudio({ ...cur, id }).catch(() => undefined);
    nameField = '';
    refresh();
  }

  async function load(id: string) {
    const d = readDraft(id);
    if (!d) return;
    const audio = await getAudio(id).catch(() => undefined);
    // Mirror the named draft's audio into CURRENT_ID before swapping chart state. App.svelte's
    // audio-rehydrate $effect reads from CURRENT_ID and dedupes by filename + byteLength;
    // without this copy it sees the previously-loaded draft's bytes and skips reload.
    if (audio) {
      await putAudio({ ...audio, id: CURRENT_ID }).catch(() => undefined);
    } else {
      await deleteAudio(CURRENT_ID).catch(() => undefined);
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
