<script lang="ts">
  import { editor, setSnap, setSnapDivision, setZoom } from '../../lib/state/editorStore';
  import { SNAP_DIVISIONS, type SnapDivision } from '../../lib/timing/snap';

  interface Props {
    currentSec: number;
    durationSec: number;
    playing: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onSeekStart?: () => void;
    onSeekEnd?: () => void;
  }
  const { currentSec, durationSec, playing, onPlay, onPause, onSeekStart, onSeekEnd }: Props = $props();

  function fmt(s: number): string {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
  }

  const divisions: SnapDivision[] = ['1/4', '1/8', '1/16', '1/32', '1/3', '1/6'];
</script>

<footer class="transport">
  <div class="group">
    <button onclick={() => onSeekStart?.()} title="Home">⏮</button>
    {#if playing}
      <button class="play" onclick={() => onPause?.()} title="Pause (Space)">⏸</button>
    {:else}
      <button class="play" onclick={() => onPlay?.()} title="Play (Space)">▶</button>
    {/if}
    <button onclick={() => onSeekEnd?.()} title="End">⏭</button>
  </div>

  <div class="time mono">
    {fmt(currentSec)} <span class="dim">/</span> {fmt(durationSec)}
  </div>

  <div class="group right">
    <label class="zoom">
      <button onclick={() => setZoom($editor.pixelsPerSecond / 1.25)}>−</button>
      <span class="mono">{Math.round($editor.pixelsPerSecond)} px/s</span>
      <button onclick={() => setZoom($editor.pixelsPerSecond * 1.25)}>+</button>
    </label>

    <label class="snap">
      <input
        type="checkbox"
        checked={$editor.snapEnabled}
        onchange={(e) => setSnap((e.currentTarget as HTMLInputElement).checked)}
      />
      snap
    </label>
    <select
      value={$editor.snapDivision}
      onchange={(e) => setSnapDivision((e.currentTarget as HTMLSelectElement).value as SnapDivision)}
    >
      {#each divisions as d}
        <option value={d}>{d} ({SNAP_DIVISIONS[d]}t)</option>
      {/each}
    </select>
  </div>
</footer>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    height: 44px;
    padding: 0 var(--sp-4);
    border-top: var(--hairline);
    background: var(--bg-0);
    font-size: 13px;
  }
  .group {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .group.right {
    margin-left: auto;
  }
  button {
    background: var(--bg-2);
    border: var(--hairline);
    color: var(--fg);
    padding: 5px 12px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover {
    background: var(--bg-3);
  }
  .play {
    width: 36px;
  }
  .time {
    font-size: 16px;
  }
  .dim {
    color: var(--fg-mute);
  }
  .zoom {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    border: var(--hairline);
    padding: 3px 8px;
    border-radius: 2px;
  }
  .zoom button {
    border: none;
    background: transparent;
    padding: 0 6px;
  }
  .snap {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  select {
    background: var(--bg-2);
    border: var(--hairline);
    padding: 4px 6px;
    border-radius: 2px;
    font-size: 13px;
  }
</style>
