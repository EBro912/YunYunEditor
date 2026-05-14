// 2D-canvas drawing primitives for the chart. Pure functions taking a CanvasRenderingContext2D
// and a viewport definition; no Svelte / DOM access.

import type { LevelJson } from '../../lib/model/level';
import type { TempoSegment } from '../../lib/timing/ticks';
import { tickToSeconds, TPQN } from '../../lib/timing/ticks';
import { barTicks } from '../../lib/timing/snap';
import { LANE_RANGE, type HoldNote, type RushNote, type SingleNote } from '../../lib/model/notes';

export interface Viewport {
  width: number;
  height: number;
  leftGutter: number; // x where the event-label area ends (also the click-to-seek boundary)
  playfieldX: number; // x where the lane area begins (>= leftGutter, may be inset to center the playfield)
  playfieldWidth: number; // total lane area width = laneWidth * laneCount
  laneWidth: number;
  laneCount: number; // 4 in v1
  laneStart: number; // first exposed lane index (2 in v1) — TODO(lanes-1-6)
  pixelsPerSecond: number;
  // The y where "now" sits on the canvas — playhead is fixed at this row.
  playheadY: number;
  // Song-time at the playhead.
  playheadSec: number;
}

export interface DrawState {
  level: LevelJson;
  tempoMap: TempoSegment[];
  selection: Set<string>;
}

export const COLORS = {
  bg: '#14151a',
  laneEdge: 'rgba(185, 124, 255, 0.06)',
  laneMid: 'rgba(63, 207, 111, 0.06)',
  laneEdgeStroke: 'rgba(185, 124, 255, 0.55)',
  laneMidStroke: 'rgba(63, 207, 111, 0.55)',
  laneSep: '#222530',
  bar: '#3b3f4a',
  beat: '#262932',
  subdiv: '#1c1f27',
  playhead: '#ff6b6b',
  noteSingleEdge: '#b97cff',
  noteSingleMid: '#3fcf6f',
  noteHoldEdge: 'rgba(185, 124, 255, 0.5)',
  noteHoldMid: 'rgba(63, 207, 111, 0.5)',
  noteRush: '#ffb454',
  selectionRing: '#6aa9ff',
  bpmMarker: '#6aa9ff',
  tsMarker: '#ffb454',
  phaseMarker: '#b97cff',
  text: '#a4a7b0',
  scanline: 'rgba(255, 255, 255, 0.012)',
};

export function laneIsEdge(laneIdx: number): boolean {
  // Lanes 2 and 5 are the purple edges; 3 and 4 are the green middles.
  return laneIdx === LANE_RANGE.min || laneIdx === LANE_RANGE.max;
}

// Game convention: notes spawn at the top and fall toward the hit-line at the bottom.
// playheadY (the hit-line) sits ~70% down. Future song-time → smaller y (higher up). As the playhead
// advances, the same note's y grows → it moves down toward the hit-line.
export function secondsToY(sec: number, vp: Viewport): number {
  return vp.playheadY - (sec - vp.playheadSec) * vp.pixelsPerSecond;
}

export function tickToY(tick: number, vp: Viewport, map: TempoSegment[], scoreOffset: number): number {
  return secondsToY(tickToSeconds(tick, map, scoreOffset), vp);
}

export function laneToX(lane: number, vp: Viewport): number {
  const idx = lane - vp.laneStart;
  return vp.playfieldX + idx * vp.laneWidth;
}

function noteRectXY(tick: number, lane: number, vp: Viewport, state: DrawState): { x: number; y: number } {
  return {
    x: laneToX(lane, vp),
    y: tickToY(tick, vp, state.tempoMap, state.level.ScoreOffset),
  };
}

export function draw(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState): void {
  const { width, height } = vp;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  drawLanes(ctx, vp);
  drawGrid(ctx, vp, state);
  drawEvents(ctx, vp, state);
  drawTargets(ctx, vp);
  drawNotes(ctx, vp, state);
  drawPlayhead(ctx, vp);
  drawScanlines(ctx, vp);
}

function drawTargets(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  // Empty per-lane outline at the hit-line, framing where notes will land.
  const y = Math.round(vp.playheadY - NOTE_HEIGHT / 2) + 0.5;
  const h = NOTE_HEIGHT;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < vp.laneCount; i++) {
    const lane = vp.laneStart + i;
    const x = laneToX(lane, vp);
    const rx = Math.round(x + NOTE_PAD_X) + 0.5;
    const rw = Math.round(vp.laneWidth - NOTE_PAD_X * 2);
    ctx.strokeStyle = laneIsEdge(lane) ? COLORS.laneEdgeStroke : COLORS.laneMidStroke;
    ctx.strokeRect(rx, y, rw, h);
  }
}

function drawLanes(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  for (let i = 0; i < vp.laneCount; i++) {
    const lane = vp.laneStart + i;
    const x = laneToX(lane, vp);
    ctx.fillStyle = laneIsEdge(lane) ? COLORS.laneEdge : COLORS.laneMid;
    ctx.fillRect(x, 0, vp.laneWidth, vp.height);
    ctx.strokeStyle = COLORS.laneSep;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, vp.height);
    ctx.stroke();
  }
  // closing separator on the right edge of the playfield
  const right = vp.playfieldX + vp.playfieldWidth;
  ctx.beginPath();
  ctx.moveTo(right + 0.5, 0);
  ctx.lineTo(right + 0.5, vp.height);
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState): void {
  const { level, tempoMap } = state;
  const gridLeft = vp.playfieldX;
  const gridRight = vp.playfieldX + vp.playfieldWidth;
  // Walk every TS segment, drawing bar & beat lines. We over-iterate to a generous upper bound
  // (~40 min at 120 BPM) for the final segment, since the per-line viewport cull handles efficiency.
  const tsList = [level.InitTimeSignature, ...level.TimeSignature];
  const FAR_TICK = 2_000_000;
  for (let si = 0; si < tsList.length; si++) {
    const ts = tsList[si];
    const nextTick = si + 1 < tsList.length ? tsList[si + 1].Tick : FAR_TICK;
    const bt = barTicks(ts);
    // A garbage time-signature (0, negative, or Infinity) makes the bar loop never advance;
    // skip the segment instead of hanging the render loop.
    if (!Number.isFinite(bt) || bt <= 0) continue;
    const beatTicks = TPQN;
    // bars
    for (let t = ts.Tick; t < nextTick; t += bt) {
      const y = tickToY(t, vp, tempoMap, level.ScoreOffset);
      if (y < -2 || y > vp.height + 2) continue;
      ctx.strokeStyle = COLORS.bar;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gridLeft, Math.round(y) + 0.5);
      ctx.lineTo(gridRight, Math.round(y) + 0.5);
      ctx.stroke();
    }
    // beats (skip on bars)
    for (let t = ts.Tick; t < nextTick; t += beatTicks) {
      if ((t - ts.Tick) % bt === 0) continue;
      const y = tickToY(t, vp, tempoMap, level.ScoreOffset);
      if (y < -1 || y > vp.height + 1) continue;
      ctx.strokeStyle = COLORS.beat;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gridLeft, Math.round(y) + 0.5);
      ctx.lineTo(gridRight, Math.round(y) + 0.5);
      ctx.stroke();
    }
  }
}

function drawEvents(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState): void {
  const { level, tempoMap } = state;
  const drawMarker = (tick: number, color: string, label: string) => {
    const y = tickToY(tick, vp, tempoMap, level.ScoreOffset);
    if (y < -10 || y > vp.height + 10) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.round(y) - 1, vp.leftGutter - 4, 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 4, Math.round(y) - 8);
  };

  drawMarker(level.InitBpm.Tick, COLORS.bpmMarker, `${level.InitBpm.Bpm.toFixed(1)} BPM`);
  for (const e of level.BpmChangeEvents) drawMarker(e.Tick, COLORS.bpmMarker, `${e.Bpm.toFixed(1)} BPM`);
  drawMarker(level.InitTimeSignature.Tick, COLORS.tsMarker, `${level.InitTimeSignature.Numerator}/${level.InitTimeSignature.Denominator}`);
  for (const e of level.TimeSignature) drawMarker(e.Tick, COLORS.tsMarker, `${e.Numerator}/${e.Denominator}`);
  for (const e of level.PhaseChangeEvents) drawMarker(e.Tick, COLORS.phaseMarker, '◇ phase');
}

function drawNotes(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState): void {
  const { level } = state;
  const inLane = (l: number) => l >= vp.laneStart && l < vp.laneStart + vp.laneCount;

  // Draw holds first so singles render on top.
  for (const n of level.HoldNotes) {
    if (!inLane(n.Lane)) continue;
    drawHold(ctx, vp, state, n);
  }
  for (const n of level.RushNotes) {
    if (!inLane(n.Lane) || !inLane(n.Lane + 1)) continue;
    drawRush(ctx, vp, state, n);
  }
  for (const n of level.SingleNotes) {
    if (!inLane(n.Lane)) continue;
    drawSingle(ctx, vp, state, n);
  }
}

const NOTE_HEIGHT = 22;
const NOTE_PAD_X = 6;

function drawSingle(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState, n: SingleNote): void {
  const { x, y } = noteRectXY(n.Tick, n.Lane, vp, state);
  if (y < -NOTE_HEIGHT || y > vp.height + NOTE_HEIGHT) return;
  const color = laneIsEdge(n.Lane) ? COLORS.noteSingleEdge : COLORS.noteSingleMid;
  ctx.fillStyle = color;
  const rx = Math.round(x + NOTE_PAD_X);
  const ry = Math.round(y - NOTE_HEIGHT / 2);
  const rw = Math.round(vp.laneWidth - NOTE_PAD_X * 2);
  const rh = NOTE_HEIGHT;
  ctx.fillRect(rx, ry, rw, rh);
  // bevel
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(rx, ry, rw, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(rx, ry + rh - 1, rw, 1);
  if (n.id && state.selection.has(n.id)) outlineSelection(ctx, rx, ry, rw, rh);
}

function drawHold(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState, n: HoldNote): void {
  const { x, y: yStart } = noteRectXY(n.Tick, n.Lane, vp, state);
  const yEnd = tickToY(n.Tick + n.Duration, vp, state.tempoMap, state.level.ScoreOffset);
  // Future ticks → smaller y, so yEnd is above yStart on screen. Cull only when the entire span
  // is off the same edge — a long hold whose tail has already scrolled past the top must still
  // render its head, so testing yEnd alone would wrongly drop the whole note.
  if (Math.max(yStart, yEnd) < -NOTE_HEIGHT || Math.min(yStart, yEnd) > vp.height + NOTE_HEIGHT) return;
  const color = laneIsEdge(n.Lane) ? COLORS.noteHoldEdge : COLORS.noteHoldMid;
  const rx = Math.round(x + NOTE_PAD_X);
  const rw = Math.round(vp.laneWidth - NOTE_PAD_X * 2);
  // tail. Derive tailH from rounded endpoints so the bottom edge lands on the same pixel as the
  // beat/bar grid line drawn at round(yEnd) — independently rounding tailTop and tailH (via
  // round(diff)) drifts by up to a pixel at small durations like 1/16.
  ctx.fillStyle = color;
  const tailTop = Math.round(Math.min(yStart, yEnd));
  const tailBottom = Math.round(Math.max(yStart, yEnd));
  const tailH = Math.max(2, tailBottom - tailTop);
  ctx.fillRect(rx + Math.round(rw * 0.25), tailTop, Math.round(rw * 0.5), tailH);
  // head
  drawSingle(ctx, vp, state, n as unknown as SingleNote);
}

function drawRush(ctx: CanvasRenderingContext2D, vp: Viewport, state: DrawState, n: RushNote): void {
  const xLeft = laneToX(n.Lane, vp);
  const xRight = laneToX(n.Lane + 2, vp);
  const yStart = tickToY(n.Tick, vp, state.tempoMap, state.level.ScoreOffset);
  const yEnd = tickToY(n.Tick + n.Duration, vp, state.tempoMap, state.level.ScoreOffset);
  // See drawHold: cull on the span's bounding box, not on yEnd alone.
  if (Math.max(yStart, yEnd) < -NOTE_HEIGHT || Math.min(yStart, yEnd) > vp.height + NOTE_HEIGHT) return;
  const rx = Math.round(xLeft + NOTE_PAD_X);
  const rw = Math.round(xRight - xLeft - NOTE_PAD_X * 2);
  // tail. See drawHold for why endpoints are rounded independently.
  ctx.fillStyle = 'rgba(255, 180, 84, 0.28)';
  const tailTop = Math.round(Math.min(yStart, yEnd));
  const tailBottom = Math.round(Math.max(yStart, yEnd));
  const tailH = Math.max(2, tailBottom - tailTop);
  ctx.fillRect(rx + Math.round(rw * 0.15), tailTop, Math.round(rw * 0.7), tailH);
  // head
  ctx.fillStyle = COLORS.noteRush;
  const ry = Math.round(yStart - NOTE_HEIGHT / 2);
  ctx.fillRect(rx, ry, rw, NOTE_HEIGHT);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(rx, ry, rw, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(rx, ry + NOTE_HEIGHT - 1, rw, 1);
  if (n.id && state.selection.has(n.id)) outlineSelection(ctx, rx, ry, rw, NOTE_HEIGHT);
}

function outlineSelection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = COLORS.selectionRing;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
}

function drawPlayhead(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const y = Math.round(vp.playheadY) + 0.5;
  ctx.moveTo(vp.playfieldX, y);
  ctx.lineTo(vp.playfieldX + vp.playfieldWidth, y);
  ctx.stroke();
  // small triangle pointing into the playfield from the left
  ctx.fillStyle = COLORS.playhead;
  ctx.beginPath();
  ctx.moveTo(vp.playfieldX - 8, y - 5);
  ctx.lineTo(vp.playfieldX, y);
  ctx.lineTo(vp.playfieldX - 8, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawScanlines(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  ctx.fillStyle = COLORS.scanline;
  const right = vp.playfieldX + vp.playfieldWidth;
  for (let x = vp.playfieldX; x < right; x += 2) {
    ctx.fillRect(x, 0, 1, vp.height);
  }
}

export interface HitResult {
  kind: 'single' | 'hold' | 'rush';
  index: number; // index in the kind array
  id?: string;
}

// Hit-test in canvas space. Tests notes in the active level.
export function hitTest(x: number, y: number, vp: Viewport, state: DrawState): HitResult | null {
  const { level, tempoMap } = state;
  const halfH = NOTE_HEIGHT / 2 + 2;

  for (let i = 0; i < level.SingleNotes.length; i++) {
    const n = level.SingleNotes[i];
    const px = laneToX(n.Lane, vp);
    const py = tickToY(n.Tick, vp, tempoMap, level.ScoreOffset);
    if (x >= px && x < px + vp.laneWidth && Math.abs(y - py) <= halfH) {
      return { kind: 'single', index: i, id: n.id };
    }
  }
  for (let i = 0; i < level.HoldNotes.length; i++) {
    const n = level.HoldNotes[i];
    const px = laneToX(n.Lane, vp);
    const py1 = tickToY(n.Tick, vp, tempoMap, level.ScoreOffset);
    const py2 = tickToY(n.Tick + n.Duration, vp, tempoMap, level.ScoreOffset);
    const top = Math.min(py1, py2) - halfH;
    const bot = Math.max(py1, py2) + halfH;
    if (x >= px && x < px + vp.laneWidth && y >= top && y <= bot) {
      return { kind: 'hold', index: i, id: n.id };
    }
  }
  for (let i = 0; i < level.RushNotes.length; i++) {
    const n = level.RushNotes[i];
    const pxL = laneToX(n.Lane, vp);
    const pxR = laneToX(n.Lane + 2, vp);
    const py1 = tickToY(n.Tick, vp, tempoMap, level.ScoreOffset);
    const py2 = tickToY(n.Tick + n.Duration, vp, tempoMap, level.ScoreOffset);
    const top = Math.min(py1, py2) - halfH;
    const bot = Math.max(py1, py2) + halfH;
    if (x >= pxL && x < pxR && y >= top && y <= bot) {
      return { kind: 'rush', index: i, id: n.id };
    }
  }
  return null;
}

// Convert canvas-space (x, y) to (lane, tick). lane is clamped to LANE_RANGE; tick is unrounded (caller snaps).
// Inverse of secondsToY: sec = playheadSec - (y - playheadY) / pps.
export function pickCell(x: number, y: number, vp: Viewport, state: DrawState): { lane: number; tick: number } {
  const idx = Math.floor((x - vp.playfieldX) / vp.laneWidth);
  const lane = Math.max(vp.laneStart, Math.min(vp.laneStart + vp.laneCount - 1, vp.laneStart + idx));
  const sec = vp.playheadSec - (y - vp.playheadY) / vp.pixelsPerSecond;
  const tick = Math.max(
    0,
    Math.round(secondsToTickLocal(sec, state)),
  );
  return { lane, tick };
}

function secondsToTickLocal(sec: number, state: DrawState): number {
  // Inline to avoid circular deps with timing/ticks.ts (we already have tickToY there).
  const { tempoMap, level } = state;
  const local = sec - level.ScoreOffset;
  let lo = 0;
  let hi = tempoMap.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (tempoMap[mid].sec <= local) lo = mid;
    else hi = mid - 1;
  }
  const seg = tempoMap[lo];
  return seg.tick + (local - seg.sec) / seg.spt;
}
