<script lang="ts">
  import { activeLevel, patchActiveLevel } from '../../lib/state/chartStore';
  import type { BpmEvent, TimeSignatureEvent, PhaseEvent, LevelJson } from '../../lib/model/level';

  type Tab = 'bpm' | 'ts' | 'phase';
  let tab = $state<Tab>('bpm');

  function bumpTick(initTick: number, baseTick: number): number {
    return Math.max(initTick + 1, baseTick + 480);
  }

  function addBpm() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const last = lvl.BpmChangeEvents.at(-1);
    const newEv: BpmEvent = {
      Tick: bumpTick(lvl.InitBpm.Tick, last?.Tick ?? lvl.InitBpm.Tick),
      Bpm: last?.Bpm ?? lvl.InitBpm.Bpm,
    };
    patchActiveLevel({ BpmChangeEvents: [...lvl.BpmChangeEvents, newEv].sort((a, b) => a.Tick - b.Tick) });
  }
  function addTs() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const last = lvl.TimeSignature.at(-1);
    const newEv: TimeSignatureEvent = {
      Tick: bumpTick(lvl.InitTimeSignature.Tick, last?.Tick ?? lvl.InitTimeSignature.Tick),
      Numerator: last?.Numerator ?? lvl.InitTimeSignature.Numerator,
      Denominator: last?.Denominator ?? lvl.InitTimeSignature.Denominator,
    };
    patchActiveLevel({ TimeSignature: [...lvl.TimeSignature, newEv].sort((a, b) => a.Tick - b.Tick) });
  }
  function addPhase() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const last = lvl.PhaseChangeEvents.at(-1);
    const newEv: PhaseEvent = { Tick: (last?.Tick ?? 0) + 480 };
    patchActiveLevel({ PhaseChangeEvents: [...lvl.PhaseChangeEvents, newEv].sort((a, b) => a.Tick - b.Tick) });
  }

  function patchInitBpm<K extends keyof BpmEvent>(field: K, v: BpmEvent[K]) {
    if (field === 'Tick') return; // init is always at tick 0
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ InitBpm: { ...lvl.InitBpm, [field]: v } });
  }
  function patchBpmAt(idx: number, field: keyof BpmEvent, v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.BpmChangeEvents.slice();
    arr[idx] = { ...arr[idx], [field]: v };
    arr.sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ BpmChangeEvents: arr });
  }
  function deleteBpmAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
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
    arr.sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ TimeSignature: arr });
  }
  function deleteTsAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ TimeSignature: lvl.TimeSignature.filter((_, i) => i !== idx) });
  }

  function patchPhaseAt(idx: number, v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const arr = lvl.PhaseChangeEvents.slice();
    arr[idx] = { Tick: v };
    arr.sort((a, b) => a.Tick - b.Tick);
    patchActiveLevel({ PhaseChangeEvents: arr });
  }
  function deletePhaseAt(idx: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ PhaseChangeEvents: lvl.PhaseChangeEvents.filter((_, i) => i !== idx) });
  }

  function patchScoreOffset(v: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    patchActiveLevel({ ScoreOffset: v });
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

  <div class="offset">
    <label>
      <span>ScoreOffset (s)</span>
      <input
        type="number"
        step="0.001"
        value={lvl.ScoreOffset}
        oninput={(e) => patchScoreOffset(Number((e.currentTarget as HTMLInputElement).value))}
      />
      <button class="mini" onclick={() => patchScoreOffset((lvl.ScoreOffset ?? 0) - 0.001)} title="−1ms">−</button>
      <button class="mini" onclick={() => patchScoreOffset((lvl.ScoreOffset ?? 0) + 0.001)} title="+1ms">+</button>
    </label>
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
                oninput={(e) => patchBpmAt(i, 'Tick', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.001"
                value={ev.Bpm}
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
              value={lvl.InitTimeSignature.Numerator}
              oninput={(e) => patchInitTs('Numerator', Number((e.currentTarget as HTMLInputElement).value))}
            />
          </td>
          <td>
            <input
              type="number"
              value={lvl.InitTimeSignature.Denominator}
              oninput={(e) => patchInitTs('Denominator', Number((e.currentTarget as HTMLInputElement).value))}
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
                oninput={(e) => patchTsAt(i, 'Tick', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                value={ev.Numerator}
                oninput={(e) => patchTsAt(i, 'Numerator', Number((e.currentTarget as HTMLInputElement).value))}
              />
            </td>
            <td>
              <input
                type="number"
                value={ev.Denominator}
                oninput={(e) => patchTsAt(i, 'Denominator', Number((e.currentTarget as HTMLInputElement).value))}
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
  .offset {
    margin-bottom: var(--sp-2);
  }
  .offset label {
    display: grid;
    grid-template-columns: 1fr 80px auto auto;
    gap: 4px;
    align-items: center;
    font-size: 11px;
    color: var(--fg-dim);
  }
  .offset input {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 2px 4px;
    border-radius: 2px;
    font-family: var(--font-mono);
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
