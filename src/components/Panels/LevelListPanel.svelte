<script lang="ts">
  import {
    chart,
    setActiveLevel,
    addLevel,
    removeLevelRefAt,
    duplicateLevelRefAt,
    patchLevelRef,
    renameLevelRef,
    setLevelSlotAt,
    swapLevelSlotAt,
  } from '../../lib/state/chartStore';
  import { pushHistory } from '../../lib/state/history';
  import { SUPPORTED_LEVELS } from '../../lib/model/level';

  let nextEditor = $state('');
  let nextLevel = $state<number>(SUPPORTED_LEVELS[0]);
  let nextDifficulty = $state(1);

  const usedLevels = $derived(
    new Set(
      $chart.song.Levels
        .map((r) => $chart.levels[r.Path]?.Level)
        .filter((v): v is number => typeof v === 'number'),
    ),
  );
  const freeLevels = $derived((SUPPORTED_LEVELS as readonly number[]).filter((v) => !usedLevels.has(v)));

  // Keep the picker pointed at a free slot as charts are added/removed elsewhere.
  $effect(() => {
    if (usedLevels.has(nextLevel) && freeLevels.length > 0) nextLevel = freeLevels[0];
  });

  function add() {
    const ed = nextEditor.trim() || 'Editor';
    if (freeLevels.length === 0) {
      alert(`All level slots (${SUPPORTED_LEVELS.join(', ')}) are in use.`);
      return;
    }
    if (usedLevels.has(nextLevel)) {
      alert(`Level slot ${nextLevel} is already in use.`);
      return;
    }
    pushHistory();
    addLevel(ed, nextLevel, nextDifficulty);
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

  // Per-row slot change. If another chart already holds the picked slot, prompt for a swap
  // instead of rejecting outright (the old reject-with-alert flow left the <select> visually
  // stuck on the rejected value because no state changed to drive a re-bind).
  function changeSlot(idx: number, v: number, target: HTMLSelectElement) {
    const ref = $chart.song.Levels[idx];
    if (!ref) return;
    const cur = $chart.levels[ref.Path]?.Level;
    if (cur === v) return;
    const other = $chart.song.Levels.find(
      (r, i) => i !== idx && $chart.levels[r.Path]?.Level === v,
    );
    if (other) {
      const ok = confirm(
        `Level slot L${v} is currently used by "${other.Path}".\n\nSwap their slots?`,
      );
      if (ok) {
        pushHistory();
        if (!swapLevelSlotAt(idx, v)) target.value = String(cur ?? '');
      } else {
        target.value = String(cur ?? '');
      }
    } else {
      pushHistory();
      if (!setLevelSlotAt(idx, v)) target.value = String(cur ?? '');
    }
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
        <select
          class="slot-edit mono"
          value={lvlFile?.Level ?? ''}
          onchange={(e) => {
            const sel = e.currentTarget as HTMLSelectElement;
            changeSlot(i, Number(sel.value), sel);
          }}
          title="Level slot"
        >
          {#each SUPPORTED_LEVELS as v}
            <option value={v}>L{v}</option>
          {/each}
          {#if lvlFile && !(SUPPORTED_LEVELS as readonly number[]).includes(lvlFile.Level)}
            <option value={lvlFile.Level}>L{lvlFile.Level}*</option>
          {/if}
        </select>
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
        <button
          class="mini"
          onclick={() => {
            if (freeLevels.length === 0) {
              alert(`Cannot duplicate: all slots (${SUPPORTED_LEVELS.join(', ')}) are in use.`);
              return;
            }
            pushHistory();
            duplicateLevelRefAt(i);
          }}
          title="duplicate"
        >⧉</button>
        <button class="mini" onclick={() => { pushHistory(); removeLevelRefAt(i); }} title="remove">✕</button>
      </div>
    </li>
  {/each}
</ul>

{#if freeLevels.length === 0}
  <p
    class="add-note"
    title={`All slots (${SUPPORTED_LEVELS.join(', ')}) in use — remove or repurpose a level first`}
  >
    All level slots ({SUPPORTED_LEVELS.join(', ')}) are in use.
  </p>
{/if}
<div class="add" class:full={freeLevels.length === 0}>
  <input
    class="ed mono"
    type="text"
    placeholder="editor"
    bind:value={nextEditor}
    disabled={freeLevels.length === 0}
  />
  <select
    class="lv mono"
    bind:value={nextLevel}
    disabled={freeLevels.length === 0}
    title={freeLevels.length === 0 ? 'All level slots are in use — remove or repurpose a level to free one' : 'Level slot'}
  >
    {#each SUPPORTED_LEVELS as v}
      <option value={v} disabled={usedLevels.has(v)}>L{v}{usedLevels.has(v) ? ' (used)' : ''}</option>
    {/each}
  </select>
  <input
    class="diff mono"
    type="number"
    min="1"
    max="20"
    bind:value={nextDifficulty}
    disabled={freeLevels.length === 0}
    title="Star rating (1..20)"
  />
  <button
    onclick={add}
    disabled={freeLevels.length === 0}
    title={freeLevels.length === 0 ? `All slots (${SUPPORTED_LEVELS.join(', ')}) in use — remove a level first` : 'Add a new level'}
  >+ Level</button>
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
    grid-template-columns: 1fr 50px 50px 1fr 22px 22px;
    gap: 2px;
    padding: 4px;
    background: var(--bg-1);
  }
  .edit input,
  .edit select {
    background: var(--bg-2);
    border: var(--hairline-soft);
    color: var(--fg);
    padding: 2px 4px;
    font-size: 10px;
    border-radius: 2px;
    min-width: 0;
  }
  .add-note {
    margin: var(--sp-2) 0 4px 0;
    font-size: 10px;
    color: var(--fg-mute);
    font-style: italic;
  }
  .add {
    display: grid;
    grid-template-columns: 1fr 50px 50px auto;
    gap: 4px;
    margin-top: var(--sp-2);
  }
  .add input,
  .add select {
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
  .add.full {
    opacity: 0.45;
  }
  .add input:disabled,
  .add select:disabled,
  .add button:disabled {
    background: var(--bg-1);
    color: var(--fg-mute);
    border-style: dashed;
    cursor: not-allowed;
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
