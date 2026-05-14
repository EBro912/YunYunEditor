<script lang="ts">
  import { activeLevel, patchActiveLevel } from '../../lib/state/chartStore';
  import { editor } from '../../lib/state/editorStore';
  import { pushHistory } from '../../lib/state/history';
  import { snapTick } from '../../lib/timing/snap';
  import type { BpmEvent, TimeSignatureEvent, PhaseEvent, LevelJson } from '../../lib/model/level';

  type Tab = 'bpm' | 'ts' | 'phase';
  let tab = $state<Tab>('bpm');

  function spawnTick(lvl: LevelJson): number {
    const t = $editor.playheadTick;
    if (!$editor.snapEnabled) return Math.max(0, t);
    return Math.max(0, snapTick(t, lvl.InitTimeSignature, lvl.TimeSignature, $editor.snapDivision));
  }

  // Time-signature numerator/denominator feed barTicks() = TPQN*num*4/den, which the grid loop
  // increments by. Zero, negative, or non-finite values can hang or break rendering, so coerce
  // raw input to a positive integer and fall back to 1 on garbage.
  function toPositiveInt(v: string): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }

  // Last event strictly before `tick`. New events inherit values from the segment they're being
  // inserted into, not from the final event in the array — `at(-1)` would silently change the
  // active tempo/meter between the new event and the next later event when inserting earlier.
  function lastBefore<T extends { Tick: number }>(arr: T[], tick: number): T | undefined {
    let found: T | undefined;
    for (const e of arr) {
      if (e.Tick < tick) {
        if (!found || e.Tick > found.Tick) found = e;
      }
    }
    return found;
  }

  function addBpm() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const tick = spawnTick(lvl);
    if (tick === lvl.InitBpm.Tick) {
      alert(`Tick ${tick} is the init BPM row — edit it directly instead of adding a change.`);
      return;
    }
    if (lvl.BpmChangeEvents.some((e) => e.Tick === tick)) {
      alert(`A BPM change already exists at tick ${tick}.`);
      return;
    }
    pushHistory();
    const active = lastBefore(lvl.BpmChangeEvents, tick) ?? lvl.InitBpm;
    const newEv: BpmEvent = { Tick: tick, Bpm: active.Bpm };
    patchActiveLevel({ BpmChangeEvents: [...lvl.BpmChangeEvents, newEv].sort((a, b) => a.Tick - b.Tick) });
  }
  function addTs() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const tick = spawnTick(lvl);
    if (tick === lvl.InitTimeSignature.Tick) {
      alert(`Tick ${tick} is the init time signature row — edit it directly instead of adding a change.`);
      return;
    }
    if (lvl.TimeSignature.some((e) => e.Tick === tick)) {
      alert(`A TS change already exists at tick ${tick}.`);
      return;
    }
    pushHistory();
    const active = lastBefore(lvl.TimeSignature, tick) ?? lvl.InitTimeSignature;
    const newEv: TimeSignatureEvent = {
      Tick: tick,
      Numerator: active.Numerator,
      Denominator: active.Denominator,
    };
    patchActiveLevel({ TimeSignature: [...lvl.TimeSignature, newEv].sort((a, b) => a.Tick - b.Tick) });
  }
  function addPhase() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const tick = spawnTick(lvl);
    if (lvl.PhaseChangeEvents.some((e) => e.Tick === tick)) {
      alert(`A Phase change already exists at tick ${tick}.`);
      return;
    }
    pushHistory();
    const newEv: PhaseEvent = { Tick: tick };
    patchActiveLevel({ PhaseChangeEvents: [...lvl.PhaseChangeEvents, newEv].sort((a, b) => a.Tick - b.Tick) });
  }

  function patchInitBpm<K extends keyof BpmEvent>(field: K, v: BpmEvent[K]) {
    if (field === 'Tick') return; // init is always at tick 0
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ InitBpm: { ...lvl.InitBpm, [field]: v } });
  }
  // Patches without sorting — sorting on every keystroke would reorder the array while a row is
  // keyed by index, so the focused DOM input would suddenly point at a different event. Defer
  // the sort to the field's commit (blur) via the *commit* helpers below.
  function patchBpmAt(idx: number, field: keyof BpmEvent, v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.BpmChangeEvents.slice();
    arr[idx] = { ...arr[idx], [field]: v };
    patchActiveLevel({ BpmChangeEvents: arr });
  }
  function commitBpmSort() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.BpmChangeEvents.slice().sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ BpmChangeEvents: arr });
  }
  function deleteBpmAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    pushHistory();
    patchActiveLevel({ BpmChangeEvents: lvl.BpmChangeEvents.filter((_, i) => i !== idx) });
  }

  function patchInitTs(field: keyof TimeSignatureEvent, v: number) {
    if (field === 'Tick') return;
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ InitTimeSignature: { ...lvl.InitTimeSignature, [field]: v } });
  }
  function patchTsAt(idx: number, field: keyof TimeSignatureEvent, v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.TimeSignature.slice();
    arr[idx] = { ...arr[idx], [field]: v };
    patchActiveLevel({ TimeSignature: arr });
  }
  function commitTsSort() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.TimeSignature.slice().sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ TimeSignature: arr });
  }
  function deleteTsAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    pushHistory();
    patchActiveLevel({ TimeSignature: lvl.TimeSignature.filter((_, i) => i !== idx) });
  }

  function patchPhaseAt(idx: number, v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.PhaseChangeEvents.slice();
    arr[idx] = { Tick: v };
    patchActiveLevel({ PhaseChangeEvents: arr });
  }
  function commitPhaseSort() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.PhaseChangeEvents.slice().sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ PhaseChangeEvents: arr });
  }
  function deletePhaseAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    pushHistory();
    patchActiveLevel({ PhaseChangeEvents: lvl.PhaseChangeEvents.filter((_, i) => i !== idx) });
  }

</script>

{#if !$activeLevel}
  <div class="empty">Select a level to edit events.</div>
{:else}
  {@const lvl = $activeLevel as LevelJson}
  <div class="tabs">
    <button class:active={tab === 'bpm'} onclick={() => (tab = 'bpm')}>BPM</button>
    <button class:active={tab === 'ts'} onclick={() => (tab = 'ts')}>Time Sig</button>
    <button class:active={tab === 'phase'} onclick={() => (tab = 'phase')}>Phase</button>
  </div>

  {#if tab === 'bpm'}
    <table class="ev">
      <thead><tr><th>Tick</th><th>BPM</th><th></th></tr></thead>
      <tbody>
        <tr class="init">
          <td class="mono">{lvl.InitBpm.Tick}</td>
          <td>
            <input
              type="number"
              step="0.001"
              value={lvl.InitBpm.Bpm}
              onfocus={() => pushHistory()}
              oninput={(e) => patchInitBpm('Bpm', Number((e.currentTarget as HTMLInputElement).value))}
            />
          </td>
          <td><span class="lock" title="initial — cannot delete">init</span></td>
        </tr>
        {#each lvl.BpmChangeEvents as ev, i (i)}
          <tr>
            <td>
              <input
                type="number"
                value={ev.Tick}
                onfocus={() => pushHistory()}
                onchange={commitBpmSort}
                oninput={(e) => patchBpmAt(i, 'Tick', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.001"
                value={ev.Bpm}
                onfocus={() => pushHistory()}
                oninput={(e) => patchBpmAt(i, 'Bpm', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td><button class="mini" onclick={() => deleteBpmAt(i)}>✕</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <button class="add" onclick={addBpm}>+ BPM change</button>
  {:else if tab === 'ts'}
    <table class="ev">
      <thead><tr><th>Tick</th><th>Num</th><th>Den</th><th></th></tr></thead>
      <tbody>
        <tr class="init">
          <td class="mono">{lvl.InitTimeSignature.Tick}</td>
          <td>
            <input
              type="number"
              min="1"
              value={lvl.InitTimeSignature.Numerator}
              onfocus={() => pushHistory()}
              oninput={(e) => patchInitTs('Numerator', toPositiveInt((e.currentTarget as HTMLInputElement).value))}
            />
          </td>
          <td>
            <input
              type="number"
              min="1"
              value={lvl.InitTimeSignature.Denominator}
              onfocus={() => pushHistory()}
              oninput={(e) => patchInitTs('Denominator', toPositiveInt((e.currentTarget as HTMLInputElement).value))}
            />
          </td>
          <td><span class="lock">init</span></td>
        </tr>
        {#each lvl.TimeSignature as ev, i (i)}
          <tr>
            <td>
              <input
                type="number"
                value={ev.Tick}
                onfocus={() => pushHistory()}
                onchange={commitTsSort}
                oninput={(e) => patchTsAt(i, 'Tick', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                min="1"
                value={ev.Numerator}
                onfocus={() => pushHistory()}
                oninput={(e) => patchTsAt(i, 'Numerator', toPositiveInt((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                min="1"
                value={ev.Denominator}
                onfocus={() => pushHistory()}
                oninput={(e) => patchTsAt(i, 'Denominator', toPositiveInt((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td><button class="mini" onclick={() => deleteTsAt(i)}>✕</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <button class="add" onclick={addTs}>+ TS change</button>
  {:else}
    <table class="ev">
      <thead><tr><th>Tick</th><th></th></tr></thead>
      <tbody>
        {#each lvl.PhaseChangeEvents as ev, i (i)}
          <tr>
            <td>
              <input
                type="number"
                value={ev.Tick}
                onfocus={() => pushHistory()}
                onchange={commitPhaseSort}
                oninput={(e) => patchPhaseAt(i, Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td><button class="mini" onclick={() => deletePhaseAt(i)}>✕</button></td>
          </tr>
        {:else}
          <tr><td colspan="2" class="empty">No phase changes.</td></tr>
        {/each}
      </tbody>
    </table>
    <button class="add" onclick={addPhase}>+ Phase change</button>
  {/if}
{/if}

<style>
  .empty {
    color: var(--fg-mute);
    font-size: 11px;
  }
  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: var(--sp-2);
  }
  .tabs button {
    flex: 1;
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg-dim);
    padding: 4px 0;
    cursor: pointer;
    font-size: 11px;
  }
  .tabs button:not(:first-child) {
    border-left: none;
  }
  .tabs button.active {
    background: var(--bg-3);
    color: var(--fg);
    border-color: var(--accent);
  }
  .ev {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .ev th {
    text-align: left;
    color: var(--fg-mute);
    border-bottom: var(--hairline);
    padding: 2px 4px;
    font-weight: 500;
  }
  .ev td {
    padding: 1px 2px;
    border-bottom: var(--hairline-soft);
  }
  .ev input {
    width: 100%;
    background: var(--bg-2);
    border: var(--hairline-soft);
    color: var(--fg);
    padding: 2px 4px;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .ev .init {
    background: rgba(106, 169, 255, 0.04);
  }
  .lock {
    font-size: 9px;
    color: var(--accent-dim);
    text-transform: uppercase;
  }
  .mini {
    background: transparent;
    border: var(--hairline-soft);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 2px;
  }
  .mini:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .add {
    margin-top: var(--sp-2);
    width: 100%;
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 4px 0;
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
  }
  .add:hover {
    background: var(--bg-3);
  }
</style>
