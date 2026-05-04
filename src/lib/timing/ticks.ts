import type { BpmEvent } from '../model/level';

export const TPQN = 480;

export interface TempoSegment {
  tick: number;
  sec: number;
  spt: number; // seconds per tick under this segment's bpm
  bpm: number;
}

// Build a cumulative-seconds map keyed by tick at every BPM change.
// `tickToSeconds(tick) = seg.sec + (tick - seg.tick) * seg.spt` for the seg containing tick.
export function buildTempoMap(initBpm: BpmEvent, changes: BpmEvent[]): TempoSegment[] {
  const sorted = [...changes].sort((a, b) => a.Tick - b.Tick);
  const segs: TempoSegment[] = [];
  let prevTick = initBpm.Tick;
  let prevBpm = initBpm.Bpm;
  let cumSec = 0;
  segs.push({ tick: prevTick, sec: 0, spt: bpmToSpt(prevBpm), bpm: prevBpm });
  for (const ev of sorted) {
    if (ev.Tick <= prevTick) continue; // out-of-order or duplicate at same tick — skip
    const dt = (ev.Tick - prevTick) * bpmToSpt(prevBpm);
    cumSec += dt;
    segs.push({ tick: ev.Tick, sec: cumSec, spt: bpmToSpt(ev.Bpm), bpm: ev.Bpm });
    prevTick = ev.Tick;
    prevBpm = ev.Bpm;
  }
  return segs;
}

export function bpmToSpt(bpm: number): number {
  return 60 / (bpm * TPQN);
}

function findSegByTick(map: TempoSegment[], tick: number): TempoSegment {
  let lo = 0;
  let hi = map.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (map[mid].tick <= tick) lo = mid;
    else hi = mid - 1;
  }
  return map[lo];
}

function findSegBySec(map: TempoSegment[], sec: number): TempoSegment {
  let lo = 0;
  let hi = map.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (map[mid].sec <= sec) lo = mid;
    else hi = mid - 1;
  }
  return map[lo];
}

export function tickToSeconds(tick: number, map: TempoSegment[], scoreOffset = 0): number {
  const seg = findSegByTick(map, tick);
  return scoreOffset + seg.sec + (tick - seg.tick) * seg.spt;
}

export function secondsToTick(sec: number, map: TempoSegment[], scoreOffset = 0): number {
  const local = sec - scoreOffset;
  const seg = findSegBySec(map, local);
  return seg.tick + Math.round((local - seg.sec) / seg.spt);
}
