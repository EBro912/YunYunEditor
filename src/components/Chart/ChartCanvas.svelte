<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { chart, activeLevel, mutateActiveLevel } from '../../lib/state/chartStore';
  import { editor, setPlayhead, setZoom, selectOnly, selectToggle, clearSelection } from '../../lib/state/editorStore';
  import { buildTempoMap, tickToSeconds, secondsToTick } from '../../lib/timing/ticks';
  import { snapTick } from '../../lib/timing/snap';
  import { LANE_RANGE, newId, mirrorLane, type SingleNote, type HoldNote, type RushNote } from '../../lib/model/notes';
  import type { LevelJson } from '../../lib/model/level';
  import { pushHistory } from '../../lib/state/history';
  import { transport } from '../../lib/audio/engine';
  import { draw, hitTest, pickCell, tickToY, laneToX, type Viewport, type DrawState } from './NoteRenderer';

  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLDivElement;
  let raf = 0;

  // Local layout constants — kept here so the renderer stays pure.
  const LEFT_GUTTER = 96;
  const PLAYHEAD_RATIO = 0.7;
  // The playfield is capped so notes stay readable on wide monitors. The lane area
  // is centered between the event-label gutter and the right edge of the canvas.
  const MAX_LANE_WIDTH = 140;
  const MIN_LANE_WIDTH = 40;

  let widthCss = $state(0);
  let heightCss = $state(0);
  let dpr = $state(1);

  // Drag state for hold/rush placement and note moving.
  type DragState =
    | { kind: 'place'; toolKind: 'hold' | 'rush'; lane: number; startTick: number; currentTick: number }
    | { kind: 'move'; ids: Set<string>; startCellTick: number; startCellLane: number; currentTick: number; currentLane: number };
  let drag = $state<DragState | null>(null);

  function resize() {
    if (!canvasEl || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    widthCss = rect.width;
    heightCss = rect.height;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvasEl.width = Math.max(1, Math.round(widthCss * dpr));
    canvasEl.height = Math.max(1, Math.round(heightCss * dpr));
    canvasEl.style.width = `${widthCss}px`;
    canvasEl.style.height = `${heightCss}px`;
  }

  function buildViewport(playheadSec: number): Viewport {
    const laneCount = LANE_RANGE.max - LANE_RANGE.min + 1;
    const available = Math.max(MIN_LANE_WIDTH * laneCount, widthCss - LEFT_GUTTER);
    const laneWidth = Math.min(MAX_LANE_WIDTH, Math.max(MIN_LANE_WIDTH, Math.floor(available / laneCount)));
    const playfieldWidth = laneWidth * laneCount;
    // Center the playfield in the area to the right of the label gutter. Clamp to leftGutter
    // when the canvas is narrow so the lanes stay anchored next to their labels.
    const playfieldX = Math.max(LEFT_GUTTER, Math.round(LEFT_GUTTER + (widthCss - LEFT_GUTTER - playfieldWidth) / 2));
    return {
      width: widthCss,
      height: heightCss,
      leftGutter: LEFT_GUTTER,
      playfieldX,
      playfieldWidth,
      laneWidth,
      laneCount,
      laneStart: LANE_RANGE.min,
      pixelsPerSecond: $editor.pixelsPerSecond,
      playheadY: heightCss * PLAYHEAD_RATIO,
      playheadSec,
    };
  }

  function buildState(): DrawState | null {
    const lvl = $activeLevel;
    if (!lvl) return null;
    const tempoMap = buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents);
    return { level: lvl, tempoMap, selection: $editor.selection };
  }

  function paint() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const state = buildState();
    if (!state) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.fillStyle = '#14151a';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      return;
    }
    const playheadSec = tickToSeconds($editor.playheadTick, state.tempoMap, state.level.ScoreOffset);
    const vp = buildViewport(playheadSec);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, vp, state);
    drawDragOverlay(ctx, vp, state);
  }

  function drawDragOverlay(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState) {
    if (!drag) return;
    if (drag.kind === 'place') {
      const tickFrom = Math.min(drag.startTick, drag.currentTick);
      const tickTo = Math.max(drag.startTick, drag.currentTick);
      const yFrom = tickToY(tickFrom, vp, state.tempoMap, state.level.ScoreOffset);
      const yTo = tickToY(tickTo, vp, state.tempoMap, state.level.ScoreOffset);
      const xLeftLane = laneToX(drag.lane, vp);
      const pad = 6; // matches NOTE_PAD_X in NoteRenderer
      const w = drag.toolKind === 'rush' ? vp.laneWidth * 2 - pad * 2 : vp.laneWidth - pad * 2;
      const xLeft = xLeftLane + pad;
      ctx.fillStyle = drag.toolKind === 'rush' ? 'rgba(255,180,84,0.4)' : 'rgba(106,169,255,0.4)';
      ctx.fillRect(xLeft, Math.min(yFrom, yTo), w, Math.max(2, Math.abs(yTo - yFrom)));
    }
  }

  function loop() {
    // A throw inside paint() must not break the rAF chain — that would freeze the canvas
    // for the rest of the session with no recovery short of a remount.
    try {
      paint();
    } catch (err) {
      console.error('chart paint failed', err);
    }
    raf = requestAnimationFrame(loop);
  }

  function snapToCurrent(tick: number): number {
    const lvl = $activeLevel;
    if (!lvl || !$editor.snapEnabled) return tick;
    return snapTick(tick, lvl.InitTimeSignature, lvl.TimeSignature, $editor.snapDivision);
  }

  // Upper bound for any tick the user can drive (playhead seek, note placement). When audio is
  // loaded, the song ends at transport.duration(); without audio there's no authoritative bound,
  // so we leave the tick unclamped at the top end so navigation still works on a fresh project.
  function maxTickFor(state: DrawState): number {
    const dur = transport.duration();
    if (dur <= 0) return Number.POSITIVE_INFINITY;
    return secondsToTick(dur, state.tempoMap, state.level.ScoreOffset);
  }

  function clampTick(tick: number, state: DrawState): number {
    return Math.max(0, Math.min(maxTickFor(state), tick));
  }

  // Seeks both the editor playhead and the audio transport in lockstep so currentSec / scrollbar /
  // chart never drift apart while the user is paused. The rAF tick already syncs them while playing.
  function seekToTick(tick: number, state: DrawState): void {
    const clamped = clampTick(tick, state);
    setPlayhead(clamped);
    if (transport.isLoaded()) {
      transport.seek(tickToSeconds(clamped, state.tempoMap, state.level.ScoreOffset));
    }
  }

  function eventXY(e: MouseEvent): { x: number; y: number } {
    const r = canvasEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onMouseDown(e: MouseEvent) {
    const state = buildState();
    if (!state) return;
    const playheadSec = tickToSeconds($editor.playheadTick, state.tempoMap, state.level.ScoreOffset);
    const vp = buildViewport(playheadSec);
    const { x, y } = eventXY(e);

    if (x < vp.playfieldX || x >= vp.playfieldX + vp.playfieldWidth) {
      // Click outside the lane area seeks the playhead. Inverse of secondsToY.
      const sec = playheadSec - (y - vp.playheadY) / vp.pixelsPerSecond;
      const tick = secondsToTick(sec, state.tempoMap, state.level.ScoreOffset);
      seekToTick(tick, state);
      return;
    }

    const hit = hitTest(x, y, vp, state);
    const tool = $editor.tool;

    if (tool === 'eraser' && hit) {
      pushHistory();
      eraseHit(hit);
      return;
    }

    if (tool === 'select' || hit) {
      // Clicking on a note selects it (regardless of tool).
      if (hit && hit.id) {
        if (e.shiftKey) selectToggle(hit.id);
        else selectOnly(hit.id);
        // lockNotes lets the user click to select without accidentally starting a move drag.
        if ($editor.lockNotes) return;
        // Begin a move drag. Snap startCellTick so the delta (currentTick - startCellTick) stays
        // a multiple of the snap step — otherwise an on-grid note can drift off the grid mid-drag.
        const { lane, tick } = pickCell(x, y, vp, state);
        const startTick = snapToCurrent(tick);
        const ids = new Set<string>($editor.selection);
        if (hit.id) ids.add(hit.id);
        drag = {
          kind: 'move',
          ids,
          startCellTick: startTick,
          startCellLane: lane,
          currentTick: startTick,
          currentLane: lane,
        };
        return;
      }
      if (tool === 'select') {
        clearSelection();
        return;
      }
    }

    // Placement tool
    const cell = pickCell(x, y, vp, state);
    const tick = clampTick(snapToCurrent(cell.tick), state);
    if (tool === 'single') {
      placeSingle(tick, cell.lane);
      return;
    }
    if (tool === 'hold') {
      drag = { kind: 'place', toolKind: 'hold', lane: cell.lane, startTick: tick, currentTick: tick };
      return;
    }
    if (tool === 'rush') {
      // Rush spans Lane and Lane+1 — clamp left lane so it fits.
      const lane = Math.min(cell.lane, LANE_RANGE.max - 1);
      drag = { kind: 'place', toolKind: 'rush', lane, startTick: tick, currentTick: tick };
      return;
    }
  }

  // Returns true if any existing note in the active level occupies (tick, lane). Rush notes occupy
  // two adjacent lanes (Lane, Lane+1), so their collision footprint is wider than their stored Lane.
  function hasNoteAt(lvl: LevelJson, tick: number, lane: number): boolean {
    if (lvl.SingleNotes.some((n) => n.Tick === tick && n.Lane === lane)) return true;
    if (lvl.HoldNotes.some((n) => n.Tick === tick && n.Lane === lane)) return true;
    if (lvl.RushNotes.some((n) => n.Tick === tick && (n.Lane === lane || n.Lane + 1 === lane))) return true;
    return false;
  }

  function placeSingle(tick: number, lane: number) {
    const state = buildState();
    if (!state) return;
    const wantMirror = $editor.mirrorPlacement;
    const mirror = wantMirror ? mirrorLane(lane) : null;
    const blockDup = $editor.preventDuplicates;
    const primaryBlocked = blockDup && hasNoteAt(state.level, tick, lane);
    const mirrorBlocked = mirror != null && blockDup && hasNoteAt(state.level, tick, mirror);
    if (primaryBlocked && (mirror == null || mirrorBlocked)) return;
    pushHistory();
    mutateActiveLevel((lvl) => {
      const toAdd: SingleNote[] = [];
      if (!primaryBlocked) toAdd.push({ id: newId(), Tick: tick, Lane: lane, Type: 0 } as SingleNote);
      if (mirror != null && !mirrorBlocked && mirror !== lane) {
        toAdd.push({ id: newId(), Tick: tick, Lane: mirror, Type: 0 } as SingleNote);
      }
      return { ...lvl, SingleNotes: [...lvl.SingleNotes, ...toAdd] };
    });
  }

  function onMouseMove(e: MouseEvent) {
    if (!drag) return;
    const state = buildState();
    if (!state) return;
    const playheadSec = tickToSeconds($editor.playheadTick, state.tempoMap, state.level.ScoreOffset);
    const vp = buildViewport(playheadSec);
    const { x, y } = eventXY(e);
    const cell = pickCell(x, y, vp, state);
    const snapped = snapToCurrent(cell.tick);

    if (drag.kind === 'place') {
      // Clamp the trailing edge so a hold/rush dragged past audio end gets capped at the song end.
      drag = { ...drag, currentTick: clampTick(snapped, state) };
    } else if (drag.kind === 'move') {
      drag = { ...drag, currentTick: snapped, currentLane: cell.lane };
    }
  }

  function onMouseUp() {
    if (!drag) return;
    if (drag.kind === 'place') {
      const tickFrom = Math.min(drag.startTick, drag.currentTick);
      const tickTo = Math.max(drag.startTick, drag.currentTick);
      const duration = Math.max(60, tickTo - tickFrom);
      const lane = drag.lane;
      const toolKind = drag.toolKind;
      const wantMirror = $editor.mirrorPlacement;
      // For rush (which spans Lane and Lane+1), mirror the right end of the pair: since mirrorLane
      // is monotonically decreasing, the mirrored right end is the new left lane of the pair.
      const mirrorL = wantMirror
        ? toolKind === 'rush'
          ? mirrorLane(lane + 1)
          : mirrorLane(lane)
        : null;
      const blockDup = $editor.preventDuplicates;
      const state = buildState();
      // Rush occupies (Lane, Lane+1), so probe both slots when checking for collisions.
      const placementBlocked = (l: number): boolean => {
        if (!blockDup || !state) return false;
        if (hasNoteAt(state.level, tickFrom, l)) return true;
        if (toolKind === 'rush' && hasNoteAt(state.level, tickFrom, l + 1)) return true;
        return false;
      };
      const primaryBlocked = placementBlocked(lane);
      const mirrorBlocked = mirrorL != null && placementBlocked(mirrorL);
      if (primaryBlocked && (mirrorL == null || mirrorBlocked)) {
        drag = null;
        return;
      }
      pushHistory();
      if (toolKind === 'hold') {
        mutateActiveLevel((lvl) => {
          const adds: HoldNote[] = [];
          if (!primaryBlocked) adds.push({ id: newId(), Tick: tickFrom, Lane: lane, Type: 0, Duration: duration } as HoldNote);
          if (mirrorL != null && !mirrorBlocked && mirrorL !== lane) {
            adds.push({ id: newId(), Tick: tickFrom, Lane: mirrorL, Type: 0, Duration: duration } as HoldNote);
          }
          return { ...lvl, HoldNotes: [...lvl.HoldNotes, ...adds] };
        });
      } else {
        mutateActiveLevel((lvl) => {
          const adds: RushNote[] = [];
          if (!primaryBlocked) adds.push({ id: newId(), Tick: tickFrom, Lane: lane, Type: 0, Duration: duration } as RushNote);
          if (mirrorL != null && !mirrorBlocked && mirrorL !== lane && mirrorL >= LANE_RANGE.min && mirrorL <= LANE_RANGE.max - 1) {
            adds.push({ id: newId(), Tick: tickFrom, Lane: mirrorL, Type: 0, Duration: duration } as RushNote);
          }
          return { ...lvl, RushNotes: [...lvl.RushNotes, ...adds] };
        });
      }
    } else if (drag.kind === 'move') {
      const dTick = drag.currentTick - drag.startCellTick;
      const dLane = drag.currentLane - drag.startCellLane;
      if (dTick !== 0 || dLane !== 0) {
        const ids = drag.ids;
        pushHistory();
        mutateActiveLevel((lvl) => {
          // Rush notes occupy Lane and Lane+1 — clamping to LANE_RANGE.max would push the right
          // half outside the visible range, where the renderer silently skips it. Use max-1 for rush.
          const shift = <T extends { id?: string; Tick: number; Lane: number }>(laneMax: number) => (arr: T[]): T[] =>
            arr.map((n) => {
              if (!n.id || !ids.has(n.id)) return n;
              return {
                ...n,
                Tick: Math.max(0, n.Tick + dTick),
                Lane: Math.max(LANE_RANGE.min, Math.min(laneMax, n.Lane + dLane)),
              };
            });
          return {
            ...lvl,
            SingleNotes: shift<SingleNote>(LANE_RANGE.max)(lvl.SingleNotes),
            HoldNotes: shift<HoldNote>(LANE_RANGE.max)(lvl.HoldNotes),
            RushNotes: shift<RushNote>(LANE_RANGE.max - 1)(lvl.RushNotes),
          };
        });
      }
    }
    drag = null;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const state = buildState();
    if (!state) return;
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom($editor.pixelsPerSecond * factor);
      return;
    }
    // One notch = one beat (TPQN ticks). Sign matches "scroll down → time advances".
    // Route through seekToTick so the audio transport seeks alongside the playhead — otherwise
    // currentSec / scrollbar stay frozen until playback resumes, and the playhead can drift past
    // the song's end where placement/seek would land out of bounds.
    // Scroll up advances time — matches the playfield (future is up the screen) and the
    // bottom-anchored scrollbar (song start at bottom). Inverts the usual scroll convention.
    const beats = -e.deltaY / 100;
    const tickDelta = Math.round(beats * 480);
    seekToTick($editor.playheadTick + tickDelta, state);
  }

  onMount(() => {
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerEl);
    raf = requestAnimationFrame(loop);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });

  onDestroy(() => {
    cancelAnimationFrame(raf);
  });

  function eraseHit(hit: { kind: 'single' | 'hold' | 'rush'; index: number }) {
    mutateActiveLevel((lvl) => {
      if (hit.kind === 'single') return { ...lvl, SingleNotes: lvl.SingleNotes.filter((_, i) => i !== hit.index) };
      if (hit.kind === 'hold') return { ...lvl, HoldNotes: lvl.HoldNotes.filter((_, i) => i !== hit.index) };
      return { ...lvl, RushNotes: lvl.RushNotes.filter((_, i) => i !== hit.index) };
    });
  }
</script>

<div class="canvas-wrap" bind:this={containerEl}>
  <canvas
    bind:this={canvasEl}
    onmousedown={onMouseDown}
    onwheel={onWheel}
    tabindex="0"
  ></canvas>
  {#if !$activeLevel}
    <div class="empty-state">
      <p>No level loaded.</p>
      <p class="dim">Drop a <span class="kbd">.zip</span> mod or <span class="kbd">.ogg</span> audio file here to start.</p>
    </div>
  {:else if $activeLevel.SingleNotes.length === 0 && $activeLevel.HoldNotes.length === 0 && $activeLevel.RushNotes.length === 0 && !$chart.song.Audio}
    <div class="empty-state">
      <p class="dim">Drop an <span class="kbd">.ogg</span> audio file here, or pick a placement tool to start charting.</p>
    </div>
  {/if}
</div>

<style>
  .canvas-wrap {
    position: relative;
    flex: 1;
    overflow: hidden;
    background: var(--bg-1);
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    outline: none;
  }
  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--fg-dim);
    gap: 4px;
  }
  .dim {
    color: var(--fg-mute);
    font-size: 11px;
  }
  .kbd {
    font-family: var(--font-mono);
    background: var(--bg-2);
    border: var(--hairline-soft);
    border-radius: 2px;
    padding: 1px 4px;
    font-size: 10px;
    color: var(--fg);
  }
</style>
