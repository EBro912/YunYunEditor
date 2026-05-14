<script lang="ts">
  interface Props {
    currentSec: number;
    durationSec: number;
    pixelsPerSecond: number;
    canvasHeight: number;
    onSeek: (sec: number) => void;
  }
  const { currentSec, durationSec, pixelsPerSecond, canvasHeight, onSeek }: Props = $props();

  const BTN_HEIGHT = 24;
  const MIN_THUMB = 24;

  let trackEl: HTMLDivElement;

  // The track represents the full song matched to the playfield direction: future is up. So
  // the bottom of the track = 0:00 (song start) and the top = duration (song end). This way the
  // thumb visually travels upward as time advances, mirroring notes rising up the playfield.
  const safeDuration = $derived(durationSec > 0 ? durationSec : 0);
  const visibleSec = $derived(pixelsPerSecond > 0 ? canvasHeight / pixelsPerSecond : 0);
  const trackHeight = $derived(Math.max(0, canvasHeight - BTN_HEIGHT * 2));
  const thumbHeight = $derived(
    safeDuration > 0
      ? Math.max(MIN_THUMB, Math.min(trackHeight, (visibleSec / safeDuration) * trackHeight))
      : trackHeight,
  );
  const thumbTop = $derived(
    safeDuration > 0
      ? Math.max(0, Math.min(trackHeight - thumbHeight, (1 - currentSec / safeDuration) * (trackHeight - thumbHeight)))
      : 0,
  );

  type DragState = { offsetY: number };
  let drag = $state<DragState | null>(null);

  function clamp(v: number, lo: number, hi: number) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function secFromTrackY(trackY: number): number {
    const usable = Math.max(1, trackHeight - thumbHeight);
    const norm = clamp(trackY / usable, 0, 1);
    // Track is inverted: top = end of song, bottom = start. Map screen Y → time accordingly.
    return (1 - norm) * safeDuration;
  }

  function onThumbMouseDown(e: MouseEvent) {
    if (safeDuration <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag = { offsetY: e.clientY - rect.top };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }

  function onTrackMouseDown(e: MouseEvent) {
    if (safeDuration <= 0) return;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    // Clicking on the track jumps so the thumb is centered on the click point.
    const trackY = e.clientY - rect.top - thumbHeight / 2;
    onSeek(secFromTrackY(trackY));
    // Continue with a drag from where the thumb landed.
    drag = { offsetY: thumbHeight / 2 };
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  }

  function onWindowMouseMove(e: MouseEvent) {
    if (!drag || !trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const trackY = e.clientY - rect.top - drag.offsetY;
    onSeek(secFromTrackY(trackY));
  }

  function onWindowMouseUp() {
    drag = null;
    window.removeEventListener('mousemove', onWindowMouseMove);
    window.removeEventListener('mouseup', onWindowMouseUp);
  }

  function jumpStart() {
    onSeek(0);
  }
  function jumpEnd() {
    onSeek(safeDuration);
  }

  const disabled = $derived(safeDuration <= 0);
</script>

<div class="scrollbar" class:disabled style="height: {canvasHeight}px;">
  <button
    class="jump"
    onclick={jumpEnd}
    disabled={disabled}
    title="Jump to end (End)"
    aria-label="Jump to end"
  >⏶</button>
  <div
    class="track"
    bind:this={trackEl}
    onmousedown={onTrackMouseDown}
    role="slider"
    tabindex="-1"
    aria-valuemin="0"
    aria-valuemax={safeDuration}
    aria-valuenow={currentSec}
    aria-label="Chart position"
  >
    {#if !disabled}
      <div
        class="thumb"
        class:dragging={drag !== null}
        style="top: {thumbTop}px; height: {thumbHeight}px;"
        onmousedown={onThumbMouseDown}
        role="presentation"
      ></div>
    {/if}
  </div>
  <button
    class="jump"
    onclick={jumpStart}
    disabled={disabled}
    title="Jump to start (Home)"
    aria-label="Jump to start"
  >⏷</button>
</div>

<style>
  .scrollbar {
    position: relative;
    width: 16px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-0);
    border-left: var(--hairline);
    user-select: none;
  }
  .jump {
    height: 24px;
    flex-shrink: 0;
    background: var(--bg-2);
    border: none;
    border-bottom: var(--hairline);
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 10px;
    line-height: 1;
    padding: 0;
  }
  .jump:last-child {
    border-bottom: none;
    border-top: var(--hairline);
  }
  .jump:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--fg);
  }
  .jump:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .track {
    position: relative;
    flex: 1;
    cursor: pointer;
    background: var(--bg-1);
  }
  .scrollbar.disabled .track {
    cursor: default;
  }
  .thumb {
    position: absolute;
    left: 2px;
    right: 2px;
    background: var(--bg-3);
    border-radius: 3px;
    cursor: grab;
  }
  .thumb:hover,
  .thumb.dragging {
    background: var(--line);
  }
  .thumb.dragging {
    cursor: grabbing;
  }
</style>
