<script lang="ts">
  import {
    editor,
    setPreventDuplicates,
    setLockNotes,
    setMirrorPlacement,
    setOffsetInMs,
  } from '../../lib/state/editorStore';
  import { activeLevel, mutateActiveLevel, patchActiveLevel } from '../../lib/state/chartStore';
  import { pushHistory } from '../../lib/state/history';
  import { snapTick } from '../../lib/timing/snap';
  import type { LevelJson } from '../../lib/model/level';
  import type { HoldNote, RushNote, SingleNote } from '../../lib/model/notes';

  function patchScoreOffset(v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ ScoreOffset: v });
  }

  // The model stores ScoreOffset in seconds (preserved as a C# double on export). The ms toggle
  // is purely a display affordance — convert on the way in/out of the input.
  function offsetDisplayValue(secs: number): number {
    return $editor.offsetInMs ? Math.round(secs * 1000) : secs;
  }
  function offsetFromInput(raw: number): number {
    return $editor.offsetInMs ? raw / 1000 : raw;
  }
  function bumpOffset(lvl: LevelJson, sign: -1 | 1) {
    pushHistory();
    patchScoreOffset((lvl.ScoreOffset ?? 0) + sign * 0.001);
  }

  // After resnapping, notes that previously sat at different ticks may collapse to the same tick.
  // When preventDuplicates is on, drop the redundant copies (keep first occurrence at each
  // (Tick, Lane)). Cross-kind collisions are also dropped so a hold+single can't share a slot.
  function dedupePositions(lvl: LevelJson): LevelJson {
    const seen = new Set<string>();
    const key = (t: number, l: number) => `${t}/${l}`;
    const keepSimple = <T extends { Tick: number; Lane: number }>(n: T): boolean => {
      const k = key(n.Tick, n.Lane);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    };
    // Rush occupies (Lane, Lane+1) — register both slots so a later single/hold can't sneak in.
    const keepRush = (n: { Tick: number; Lane: number }): boolean => {
      const k1 = key(n.Tick, n.Lane);
      const k2 = key(n.Tick, n.Lane + 1);
      if (seen.has(k1) || seen.has(k2)) return false;
      seen.add(k1);
      seen.add(k2);
      return true;
    };
    return {
      ...lvl,
      SingleNotes: lvl.SingleNotes.filter(keepSimple),
      HoldNotes: lvl.HoldNotes.filter(keepSimple),
      RushNotes: lvl.RushNotes.filter(keepRush),
    };
  }

  function resnapNotes(lvl: LevelJson, predicate: (id: string | undefined) => boolean): LevelJson {
    const snap = (tick: number) =>
      snapTick(tick, lvl.InitTimeSignature, lvl.TimeSignature, $editor.snapDivision);
    const apply = <T extends { id?: string; Tick: number }>(arr: T[]): T[] =>
      arr.map((n) => (predicate(n.id) ? { ...n, Tick: snap(n.Tick) } : n));
    const snapped: LevelJson = {
      ...lvl,
      SingleNotes: apply(lvl.SingleNotes) as SingleNote[],
      HoldNotes: apply(lvl.HoldNotes) as HoldNote[],
      RushNotes: apply(lvl.RushNotes) as RushNote[],
    };
    return $editor.preventDuplicates ? dedupePositions(snapped) : snapped;
  }

  function resnapSelected() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const sel = $editor.selection;
    if (sel.size === 0) return;
    pushHistory();
    mutateActiveLevel((l) => resnapNotes(l, (id) => !!id && sel.has(id)));
  }

  function resnapAll() {
    const lvl = $activeLevel;
    if (!lvl) return;
    pushHistory();
    mutateActiveLevel((l) => resnapNotes(l, () => true));
  }

  const selectionCount = $derived($editor.selection.size);
</script>

<div class="options">
  <label class="row">
    <input
      type="checkbox"
      checked={$editor.preventDuplicates}
      onchange={(e) => setPreventDuplicates((e.currentTarget as HTMLInputElement).checked)}
    />
    <span>Prevent duplicate notes</span>
  </label>
  <label class="row">
    <input
      type="checkbox"
      checked={$editor.lockNotes}
      onchange={(e) => setLockNotes((e.currentTarget as HTMLInputElement).checked)}
    />
    <span>Lock notes</span>
  </label>
  <label class="row">
    <input
      type="checkbox"
      checked={$editor.mirrorPlacement}
      onchange={(e) => setMirrorPlacement((e.currentTarget as HTMLInputElement).checked)}
    />
    <span>Mirror placement</span>
  </label>

  {#if $activeLevel}
    {@const lvl = $activeLevel as LevelJson}
    <div class="offset-row">
      <span class="label">ScoreOffset ({$editor.offsetInMs ? 'ms' : 's'})</span>
      <input
        type="number"
        step={$editor.offsetInMs ? 1 : 0.001}
        value={offsetDisplayValue(lvl.ScoreOffset)}
        onfocus={() => pushHistory()}
        oninput={(e) => patchScoreOffset(offsetFromInput(Number((e.currentTarget as HTMLInputElement).value)))}
      />
      <button class="mini" onclick={() => bumpOffset(lvl, -1)} title="−1ms">−</button>
      <button class="mini" onclick={() => bumpOffset(lvl, +1)} title="+1ms">+</button>
      <label class="ms-toggle" title="Toggle display units (model stays in seconds)">
        <input
          type="checkbox"
          checked={$editor.offsetInMs}
          onchange={(e) => setOffsetInMs((e.currentTarget as HTMLInputElement).checked)}
        />
        <span>ms</span>
      </label>
    </div>
  {/if}

  <div class="resnap">
    <button type="button" onclick={resnapSelected} disabled={selectionCount === 0} title="Snap selected notes' Tick to the current snap division">
      Resnap selected{selectionCount > 0 ? ` (${selectionCount})` : ''}
    </button>
    <button type="button" onclick={resnapAll} disabled={!$activeLevel} title="Snap every note's Tick to the current snap division (hold/rush durations not resnapped)">
      Resnap all
    </button>
  </div>
</div>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--fg-dim);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .row input[type='checkbox'] {
    margin: 0;
    accent-color: var(--accent);
  }
  .row:hover span {
    color: var(--fg);
  }
  .offset-row {
    display: grid;
    grid-template-columns: 1fr 70px auto auto auto;
    gap: 4px;
    align-items: center;
    margin-top: 4px;
    padding-top: 6px;
    border-top: var(--hairline-soft);
    font-size: 11px;
  }
  .label {
    font-size: 11px;
  }
  .offset-row > input[type='number'] {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 2px 4px;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 11px;
    min-width: 0;
  }
  .ms-toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    cursor: pointer;
    padding-left: 4px;
  }
  .ms-toggle input[type='checkbox'] {
    margin: 0;
    accent-color: var(--accent);
  }
  .ms-toggle:hover span {
    color: var(--fg);
  }
  .mini {
    background: transparent;
    border: var(--hairline-soft);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 2px;
  }
  .mini:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .resnap {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 4px;
    padding-top: 6px;
    border-top: var(--hairline-soft);
  }
  .resnap button {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 4px 6px;
    font-size: 11px;
    border-radius: 2px;
    cursor: pointer;
  }
  .resnap button:hover:not(:disabled) {
    background: var(--bg-3);
  }
  .resnap button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
