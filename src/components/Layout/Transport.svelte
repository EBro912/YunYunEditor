<script lang="ts">
  import { onMount } from 'svelte';
  import { editor, setSnap, setSnapDivision, setZoom } from '../../lib/state/editorStore';
  import { SNAP_DIVISIONS, type SnapDivision } from '../../lib/timing/snap';
  import { transport } from '../../lib/audio/engine';

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

  const VOL_KEY = 'yunyun.volume';
  let volume = $state(1);
  let muted = $state(false);
  let preMuteVolume = 1;

  onMount(() => {
    try {
      const raw = localStorage.getItem(VOL_KEY);
      if (raw !== null) {
        const v = Number(raw);
        if (Number.isFinite(v)) {
          volume = Math.max(0, Math.min(1, v));
        }
      }
    } catch {
      // localStorage unavailable; keep default
    }
    transport.setVolume(volume);
  });

  function applyVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    muted = volume === 0;
    transport.setVolume(volume);
    try {
      localStorage.setItem(VOL_KEY, String(volume));
    } catch {
      // ignore
    }
  }

  function toggleMute() {
    if (volume > 0) {
      preMuteVolume = volume;
      applyVolume(0);
    } else {
      applyVolume(preMuteVolume > 0 ? preMuteVolume : 0.8);
    }
  }
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

  <div class="volume" title="Volume">
    <button
      class="vol-btn"
      onclick={toggleMute}
      title={muted ? 'Unmute' : 'Mute'}
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      <svg class="vol-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <!-- Shared speaker body (same in all three states). -->
        <path
          fill="currentColor"
          d="M3 6h2.2L9 3v10L5.2 10H3z"
        />
        {#if muted || volume === 0}
          <!-- Cross-out lines -->
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            d="M11 6l4 4 M15 6l-4 4"
          />
        {:else}
          <!-- Inner wave (always shown when audible) -->
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            d="M11 6c1.1.9 1.1 3.1 0 4"
          />
          {#if volume >= 0.5}
            <!-- Outer wave (shown only at higher volumes) -->
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              d="M13 4c2.2 1.8 2.2 6.2 0 8"
            />
          {/if}
        {/if}
      </svg>
    </button>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      oninput={(e) => applyVolume(Number((e.currentTarget as HTMLInputElement).value))}
      aria-label="Volume"
    />
    <span class="mono vol-pct">{Math.round(volume * 100)}%</span>
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
  .volume {
    display: flex;
    align-items: center;
    gap: 6px;
    border: var(--hairline);
    padding: 3px 8px;
    border-radius: 2px;
  }
  .vol-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--fg-dim);
    padding: 2px;
    line-height: 1;
    cursor: pointer;
    border-radius: 2px;
  }
  .vol-btn:hover {
    background: var(--bg-3);
    color: var(--fg);
  }
  .vol-icon {
    flex-shrink: 0;
    display: block;
  }
  .volume input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 90px;
    height: 4px;
    background: var(--bg-3);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .volume input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    cursor: pointer;
  }
  .volume input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    cursor: pointer;
  }
  .vol-pct {
    color: var(--fg-mute);
    font-size: 11px;
    min-width: 32px;
    text-align: right;
  }
</style>
