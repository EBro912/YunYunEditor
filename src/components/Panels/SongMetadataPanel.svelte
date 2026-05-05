<script lang="ts">
  import { chart, updateSong } from '../../lib/state/chartStore';
  import { pushHistory } from '../../lib/state/history';
  import type { SongJson } from '../../lib/model/song';

  function patch(field: keyof SongJson, value: string): void {
    updateSong({ [field]: value } as Partial<SongJson>);
  }

  // Live cross-ref check vs each level's MusicInfoName.
  const mismatches = $derived.by(() => {
    const song = $chart.song;
    const out: string[] = [];
    for (const ref of song.Levels) {
      const lvl = $chart.levels[ref.Path];
      if (lvl && lvl.MusicInfoName !== song.ID) out.push(`${ref.Path}: MusicInfoName="${lvl.MusicInfoName}"`);
    }
    return out;
  });

  const fields: { key: keyof SongJson; label: string }[] = [
    { key: 'ID', label: 'ID' },
    { key: 'Title', label: 'Title' },
    { key: 'Artist', label: 'Artist' },
    { key: 'Lyricist', label: 'Lyricist' },
    { key: 'Composer', label: 'Composer' },
    { key: 'Arranger', label: 'Arranger' },
    { key: 'Audio', label: 'Audio (filename)' },
  ];
</script>

<div class="form">
  {#each fields as f}
    <label>
      <span>{f.label}</span>
      <input
        type="text"
        value={String($chart.song[f.key] ?? '')}
        onfocus={() => pushHistory()}
        oninput={(e) => patch(f.key, (e.currentTarget as HTMLInputElement).value)}
      />
    </label>
  {/each}
</div>

{#if mismatches.length > 0}
  <div class="warn">
    <div class="warn-title">song.ID does not match these levels:</div>
    <ul>
      {#each mismatches as m}
        <li class="mono">{m}</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  label {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
  }
  span {
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
  input:focus {
    outline: 1px solid var(--accent);
  }
  .warn {
    margin-top: var(--sp-3);
    padding: var(--sp-2);
    border: 1px solid var(--warn);
    background: rgba(255, 180, 84, 0.06);
    border-radius: 2px;
    font-size: 11px;
  }
  .warn-title {
    color: var(--warn);
    margin-bottom: 4px;
  }
  ul {
    margin: 0;
    padding-left: var(--sp-3);
    font-size: 11px;
  }
</style>
