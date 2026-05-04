<script lang="ts">
  import { editor } from '../../lib/state/editorStore';
  import { activeLevel, mutateActiveLevel } from '../../lib/state/chartStore';
  import { LANE_RANGE, type SingleNote, type HoldNote, type RushNote } from '../../lib/model/notes';

  type AnyNote = (SingleNote | HoldNote | RushNote) & { id?: string };
  type Kind = 'single' | 'hold' | 'rush';

  const selectedNotes = $derived.by(() => {
    const lvl = $activeLevel;
    if (!lvl) return [] as { kind: Kind; note: AnyNote }[];
    const out: { kind: Kind; note: AnyNote }[] = [];
    for (const n of lvl.SingleNotes) if (n.id && $editor.selection.has(n.id)) out.push({ kind: 'single', note: n });
    for (const n of lvl.HoldNotes) if (n.id && $editor.selection.has(n.id)) out.push({ kind: 'hold', note: n });
    for (const n of lvl.RushNotes) if (n.id && $editor.selection.has(n.id)) out.push({ kind: 'rush', note: n });
    return out;
  });

  function nudge(field: 'Tick' | 'Lane' | 'Duration', delta: number) {
    if (selectedNotes.length === 0) return;
    const ids = new Set($editor.selection);
    mutateActiveLevel((lvl) => {
      const map = (n: AnyNote): AnyNote => {
        if (!n.id || !ids.has(n.id)) return n;
        const nn: AnyNote = { ...n };
        if (field === 'Tick') nn.Tick = Math.max(0, n.Tick + delta);
        else if (field === 'Lane') nn.Lane = Math.max(LANE_RANGE.min, Math.min(LANE_RANGE.max, n.Lane + delta));
        else if (field === 'Duration' && 'Duration' in nn) (nn as HoldNote).Duration = Math.max(1, (n as HoldNote).Duration + delta);
        return nn;
      };
      return {
        ...lvl,
        SingleNotes: lvl.SingleNotes.map(map) as SingleNote[],
        HoldNotes: lvl.HoldNotes.map(map) as HoldNote[],
        RushNotes: lvl.RushNotes.map(map) as RushNote[],
      };
    });
  }
</script>

{#if selectedNotes.length === 0}
  <div class="empty">Click a note to select.</div>
{:else}
  <div class="count">{selectedNotes.length} selected</div>
  {#if selectedNotes.length === 1}
    {@const sole = selectedNotes[0]}
    <div class="row"><span>Kind</span><span class="mono">{sole.kind}</span></div>
    <div class="row"><span>Tick</span><span class="mono">{sole.note.Tick}</span></div>
    <div class="row"><span>Lane</span><span class="mono">{sole.note.Lane}</span></div>
    {#if 'Duration' in sole.note}
      <div class="row"><span>Duration</span><span class="mono">{(sole.note as HoldNote).Duration}</span></div>
    {/if}
  {/if}

  <div class="nudge">
    <div class="nudge-row">
      <span>Tick</span>
      <button onclick={() => nudge('Tick', -120)}>−1/16</button>
      <button onclick={() => nudge('Tick', -10)}>−10</button>
      <button onclick={() => nudge('Tick', +10)}>+10</button>
      <button onclick={() => nudge('Tick', +120)}>+1/16</button>
    </div>
    <div class="nudge-row">
      <span>Lane</span>
      <button onclick={() => nudge('Lane', -1)}>−</button>
      <button onclick={() => nudge('Lane', +1)}>+</button>
    </div>
    <div class="nudge-row">
      <span>Duration</span>
      <button onclick={() => nudge('Duration', -120)}>−1/16</button>
      <button onclick={() => nudge('Duration', -10)}>−10</button>
      <button onclick={() => nudge('Duration', +10)}>+10</button>
      <button onclick={() => nudge('Duration', +120)}>+1/16</button>
    </div>
  </div>
{/if}

<style>
  .empty {
    color: var(--fg-mute);
    font-size: 11px;
  }
  .count {
    color: var(--fg-dim);
    margin-bottom: var(--sp-2);
    font-size: 11px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    border-bottom: var(--hairline-soft);
  }
  .nudge {
    margin-top: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nudge-row {
    display: grid;
    grid-template-columns: 64px repeat(4, 1fr);
    gap: 2px;
    align-items: center;
  }
  .nudge-row span {
    font-size: 11px;
    color: var(--fg-dim);
  }
  .nudge-row button {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 2px 0;
    border-radius: 2px;
    font-size: 10px;
    cursor: pointer;
  }
  .nudge-row button:hover {
    background: var(--bg-3);
  }
</style>
