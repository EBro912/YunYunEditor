// In-memory note clipboard. Copy snapshots the current selection with ticks made relative to the
// earliest selected note; paste re-anchors those relative ticks to the playhead.

import { get } from 'svelte/store';
import { chart, mutateActiveLevel } from './chartStore';
import { editor } from './editorStore';
import { pushHistory } from './history';
import { LANE_RANGE, newId, type SingleNote, type HoldNote, type RushNote } from '../model/notes';
import { transport } from '../audio/engine';
import { buildTempoMap, secondsToTick } from '../timing/ticks';

interface BaseEntry {
  relTick: number;
  Lane: number;
  Type: 0;
}
interface SingleEntry extends BaseEntry { kind: 'single'; }
interface HoldEntry extends BaseEntry { kind: 'hold'; Duration: number; }
interface RushEntry extends BaseEntry { kind: 'rush'; Duration: number; }
type ClipboardEntry = SingleEntry | HoldEntry | RushEntry;

let clipboard: ClipboardEntry[] = [];

export function copySelection(): boolean {
  const sel = get(editor).selection;
  if (sel.size === 0) return false;
  const c = get(chart);
  const path = c.activeLevelPath;
  if (!path) return false;
  const lvl = c.levels[path];
  if (!lvl) return false;

  const entries: ClipboardEntry[] = [];
  let minTick = Number.POSITIVE_INFINITY;
  for (const n of lvl.SingleNotes) {
    if (n.id && sel.has(n.id)) {
      entries.push({ kind: 'single', relTick: n.Tick, Lane: n.Lane, Type: 0 });
      if (n.Tick < minTick) minTick = n.Tick;
    }
  }
  for (const n of lvl.HoldNotes) {
    if (n.id && sel.has(n.id)) {
      entries.push({ kind: 'hold', relTick: n.Tick, Lane: n.Lane, Type: 0, Duration: n.Duration });
      if (n.Tick < minTick) minTick = n.Tick;
    }
  }
  for (const n of lvl.RushNotes) {
    if (n.id && sel.has(n.id)) {
      entries.push({ kind: 'rush', relTick: n.Tick, Lane: n.Lane, Type: 0, Duration: n.Duration });
      if (n.Tick < minTick) minTick = n.Tick;
    }
  }
  if (entries.length === 0) return false;
  for (const e of entries) e.relTick -= minTick;
  clipboard = entries;
  return true;
}

export function pasteAtPlayhead(): boolean {
  if (clipboard.length === 0) return false;
  const baseTick = get(editor).playheadTick;

  // Mirror the song-end clamp ChartCanvas applies to direct placement: when audio is loaded,
  // no note (or its trailing edge) may extend past transport.duration() in tick space.
  const c = get(chart);
  const path = c.activeLevelPath;
  const lvl = path ? c.levels[path] : null;
  const dur = transport.duration();
  const maxTick = lvl && dur > 0
    ? secondsToTick(dur, buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents), lvl.ScoreOffset)
    : Number.POSITIVE_INFINITY;

  pushHistory();
  const newIds = new Set<string>();
  mutateActiveLevel((lvl) => {
    const next = {
      ...lvl,
      SingleNotes: lvl.SingleNotes.slice(),
      HoldNotes: lvl.HoldNotes.slice(),
      RushNotes: lvl.RushNotes.slice(),
    };
    for (const e of clipboard) {
      const id = newId();
      newIds.add(id);
      const tick = Math.max(0, Math.min(maxTick, baseTick + e.relTick));
      if (e.kind === 'single') {
        next.SingleNotes.push({ id, Tick: tick, Lane: clampLane(e.Lane, LANE_RANGE.max), Type: 0 } as SingleNote);
      } else if (e.kind === 'hold') {
        const duration = Math.max(0, Math.min(e.Duration, maxTick - tick));
        next.HoldNotes.push({ id, Tick: tick, Lane: clampLane(e.Lane, LANE_RANGE.max), Type: 0, Duration: duration } as HoldNote);
      } else {
        // Rush spans Lane and Lane+1, so clamp the left lane to max-1 to keep both halves visible.
        const duration = Math.max(0, Math.min(e.Duration, maxTick - tick));
        next.RushNotes.push({ id, Tick: tick, Lane: clampLane(e.Lane, LANE_RANGE.max - 1), Type: 0, Duration: duration } as RushNote);
      }
    }
    return next;
  });
  // Select the freshly-pasted notes so the user can immediately nudge or re-paste.
  editor.update((s) => ({ ...s, selection: newIds }));
  return true;
}

function clampLane(lane: number, laneMax: number): number {
  return Math.max(LANE_RANGE.min, Math.min(laneMax, lane));
}

export function hasClipboard(): boolean {
  return clipboard.length > 0;
}
