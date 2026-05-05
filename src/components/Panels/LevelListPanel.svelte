<script lang="ts">
  import {
    chart,
    setActiveLevel,
    addLevel,
    removeLevelRefAt,
    duplicateLevelRefAt,
    patchLevelRef,
    renameLevelRef,
  } from '../../lib/state/chartStore';
  import { pushHistory } from '../../lib/state/history';
  import { SUPPORTED_LEVELS } from '../../lib/model/level';

  let nextEditor = $state('');
  let nextDifficulty = $state(1);

  function add() {
    const ed = nextEditor.trim() || 'Editor';
    pushHistory();
    addLevel(ed, nextDifficulty);
  }

  function commitPath(idx: number, value: string): void {
    pushHistory();
    const ok = renameLevelRef(idx, value);
    if (!ok) {
      // Revert the input value by forcing a re-read of the bound state.
      // Setting .value here is enough because Svelte will overwrite on next render anyway.
      alert('Path is empty, unchanged, or already in use by another level.');
    }
  }

  // True when the file's `Level` field is one of the slots the base game's song-select surfaces.
  function isSupportedLevel(lvl: number | undefined): boolean {
    return typeof lvl === 'number' && (SUPPORTED_LEVELS as readonly number[]).includes(lvl);
  }
</script>

<ul class="list">
  {#each $chart.song.Levels as ref, i (i)}
    {@const lvlFile = $chart.levels[ref.Path]}
    {@const slot = lvlFile?.Level}
    {@const slotOk = isSupportedLevel(slot)}
    <li class:active={$chart.activeLevelPath === ref.Path}>
      <button class="row" onclick={() => setActiveLevel(ref.Path)}>
        <span class="diff mono" title="Star rating (1..20)">★{ref.Difficulty}</span>
        <span
          class="slot mono"
          class:unsupported={!slotOk}
          title={slotOk
            ? `Level slot ${slot}`
            : `Level slot ${slot ?? '?'} is outside the stages the game currently surfaces (${SUPPORTED_LEVELS.join(', ')}). The file loads but won't appear in-game.`}
        >L{slot ?? '?'}{slotOk ? '' : '*'}</span>
        <span class="who">{ref.Editor || 'unnamed'}</span>
        <span class="path mono">{ref.Path}</span>
      </button>
      <div class="edit">
        <input
          class="path-edit mono"
          type="text"
          value={ref.Path}
          onchange={(e) => commitPath(i, (e.currentTarget as HTMLInputElement).value)}
          onfocus={() => pushHistory()}
          title="file path (commits on blur)"
        />
        <input
          class="diff-edit mono"
          type="number"
          min="1"
          max="20"
          value={ref.Difficulty}
          onfocus={() => pushHistory()}
          oninput={(e) =>
            patchLevelRef(i, {
              Difficulty: Number((e.currentTarget as HTMLInputElement).value) || 1,
            })}
        />
        <input
          class="ed-edit"
          type="text"
          value={ref.Editor}
          onfocus={() => pushHistory()}
          oninput={(e) => patchLevelRef(i, { Editor: (e.currentTarget as HTMLInputElement).value })}
        />
        <button class="mini" onclick={() => { pushHistory(); duplicateLevelRefAt(i); }} title="duplicate">⧉</button>
        <button class="mini" onclick={() => { pushHistory(); removeLevelRefAt(i); }} title="remove">✕</button>
      </div>
    </li>
  {/each}
</ul>

<div class="add">
  <input class="ed mono" type="text" placeholder="editor" bind:value={nextEditor} />
  <input
    class="lv mono"
    type="number"
    min="1"
    max="20"
    bind:value={nextDifficulty}
  />
  <button onclick={add}>+ Level</button>
</div>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  li {
    border: var(--hairline-soft);
    border-radius: 2px;
    overflow: hidden;
  }
  li.active {
    border-color: var(--accent);
  }
  .row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: var(--sp-2);
    align-items: center;
    width: 100%;
    padding: 4px 6px;
    background: var(--bg-2);
    border: none;
    color: var(--fg);
    text-align: left;
    cursor: pointer;
  }
  .row:hover {
    background: var(--bg-3);
  }
  .diff {
    color: var(--lane-edge);
    font-weight: 600;
  }
  .slot {
    color: var(--fg-dim);
    font-size: 10px;
  }
  .slot.unsupported {
    color: var(--fg-mute);
    text-decoration: underline dotted;
  }
  .path {
    color: var(--fg-mute);
    font-size: 10px;
  }
  .edit {
    display: grid;
    grid-template-columns: 1fr 38px 1fr 22px 22px;
    gap: 2px;
    padding: 4px;
    background: var(--bg-1);
  }
  .edit input {
    background: var(--bg-2);
    border: var(--hairline-soft);
    color: var(--fg);
    padding: 2px 4px;
    font-size: 10px;
    border-radius: 2px;
    min-width: 0;
  }
  .add {
    display: grid;
    grid-template-columns: 1fr 50px auto;
    gap: 4px;
    margin-top: var(--sp-2);
  }
  .add input {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 3px 6px;
    border-radius: 2px;
    font-size: 11px;
  }
  .add button {
    background: var(--bg-3);
    border: var(--hairline);
    color: var(--fg);
    padding: 3px 8px;
    border-radius: 2px;
    cursor: pointer;
  }
  .mini {
    background: transparent;
    border: var(--hairline-soft);
    color: var(--fg-dim);
    cursor: pointer;
    border-radius: 2px;
    font-size: 10px;
  }
  .mini:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
</style>
