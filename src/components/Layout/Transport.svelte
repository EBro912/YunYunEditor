<script lang="ts">
  import { onMount } from 'svelte';
  import { editor, setSnap, setSnapDivision, setZoom, setPlaybackRate, ZOOM_BASELINE_PPS } from '../../lib/state/editorStore';
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

  function onRateInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    setPlaybackRate(v);
    transport.setPlaybackRate(v);
  }
  function resetRate() {
    setPlaybackRate(1);
    transport.setPlaybackRate(1);
  }

  // Round-number zoom presets the +/- buttons step through, so clicks always land on a clean
  // percentage. The continuous range [40, 1200] px/s underneath is preserved for wheel zoom and
  // direct numeric input — the presets are just a convenience for the common case.
  const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500] as const;
  const currentZoomPct = $derived(Math.round(($editor.pixelsPerSecond / ZOOM_BASELINE_PPS) * 100));

  function stepZoom(direction: -1 | 1) {
    const cur = currentZoomPct;
    let target: number;
    if (direction === 1) {
      target = ZOOM_PRESETS.find((p) => p > cur) ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
    } else {
      const lower = ZOOM_PRESETS.filter((p) => p < cur);
      target = lower.length > 0 ? lower[lower.length - 1] : ZOOM_PRESETS[0];
    }
    setZoom((target / 100) * ZOOM_BASELINE_PPS);
  }
  function applyZoomPercent(pct: number) {
    if (!Number.isFinite(pct)) return;
    setZoom((pct / 100) * ZOOM_BASELINE_PPS);
  }
  function onZoomInput(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    applyZoomPercent(v);
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

  <div class="speed" title="Playback speed and pitch. Click value to reset.">
    <span class="speed-label">speed</span>
    <input
      type="range"
      min="0.25"
      max="2"
      step="0.05"
      value={$editor.playbackRate}
      oninput={onRateInput}
      aria-label="Playback speed"
    />
    <button type="button" class="speed-value mono" onclick={resetRate} aria-label="Reset playback speed to 1.0×">
      {$editor.playbackRate.toFixed(2)}×
    </button>
  </div>

  <div class="group right">
    <label class="zoom" title="Zoom (Ctrl+scroll for fine control)">
      <button onclick={() => stepZoom(-1)}>−</button>
      <input
        type="number"
        class="mono zoom-input"
        min="18"
        max="545"
        step="1"
        value={currentZoomPct}
        onchange={onZoomInput}
        aria-label="Zoom percent"
      />
      <span class="mono zoom-pct">%</span>
      <button onclick={() => stepZoom(1)}>+</button>
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
  .zoom-input {
    background: transparent;
    border: none;
    color: var(--fg);
    width: 42px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 13px;
    padding: 0;
    /* Hide spinner controls — clutter at this size; +/- buttons cover step UX. */
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .zoom-input::-webkit-outer-spin-button,
  .zoom-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .zoom-pct {
    color: var(--fg-mute);
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
  .speed {
    display: flex;
    align-items: center;
    gap: 6px;
    border: var(--hairline);
    padding: 3px 8px;
    border-radius: 2px;
  }
  .speed-label {
    color: var(--fg-mute);
    font-size: 11px;
    text-transform: lowercase;
  }
  .speed input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 80px;
    height: 4px;
    background: var(--bg-3);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .speed input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    cursor: pointer;
  }
  .speed input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    cursor: pointer;
  }
  .speed-value {
    background: transparent;
    border: none;
    color: var(--fg);
    font-size: 11px;
    padding: 0 2px;
    min-width: 40px;
    text-align: right;
    cursor: pointer;
    font-family: var(--font-mono);
  }
  .speed-value:hover {
    color: var(--accent);
  }
</style>
