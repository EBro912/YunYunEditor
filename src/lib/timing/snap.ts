import { TPQN } from './ticks';
import type { TimeSignatureEvent } from '../model/level';

// Common rhythmic divisions expressed in ticks (TPQN=480 → quarter note = 480 ticks).
export const SNAP_DIVISIONS = {
  '1/4': 480,
  '1/8': 240,
  '1/16': 120,
  '1/32': 60,
  '1/3': 160,
  '1/6': 80,
} as const satisfies Record<string, number>;

export type SnapDivision = keyof typeof SNAP_DIVISIONS;

export function snapTick(
  tick: number,
  initTs: TimeSignatureEvent,
  changes: TimeSignatureEvent[],
  division: SnapDivision,
): number {
  const step = SNAP_DIVISIONS[division];
  const anchor = mostRecentTsTick(tick, initTs, changes);
  const rel = tick - anchor;
  const snappedRel = Math.round(rel / step) * step;
  return anchor + snappedRel;
}

export function mostRecentTsTick(
  tick: number,
  initTs: TimeSignatureEvent,
  changes: TimeSignatureEvent[],
): number {
  let last = initTs.Tick;
  for (const ev of changes) {
    if (ev.Tick > tick) break;
    last = ev.Tick;
  }
  return last;
}

// Bar length in ticks for a given TS: TPQN * Numerator * 4 / Denominator (matches ScoreData.GetBar).
export function barTicks(ts: TimeSignatureEvent): number {
  return Math.round((TPQN * ts.Numerator * 4) / ts.Denominator);
}
