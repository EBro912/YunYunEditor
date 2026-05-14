// Internal note shapes augment the on-disk JSON with a uuid `id` for stable selection.
// The id is stripped on serialization (see io/export.ts).

// Lane numbering matches the Unity side: lanes 1..6 exist, but v1 only exposes 2..5.
// TODO(lanes-1-6): widen LANE_RANGE to { min: 1, max: 6 } and update palette/canvas.
export const LANE_RANGE = { min: 2, max: 5 } as const;

export type NoteKind = 'single' | 'hold' | 'rush';

export interface SingleNote {
  id?: string;
  Tick: number;
  Lane: number;
  Type: 0;
}

export interface HoldNote extends SingleNote {
  Duration: number;
}

export type ShiftNote = SingleNote;

export interface RushNote extends HoldNote {}

export function isHold(n: SingleNote | HoldNote | RushNote): n is HoldNote | RushNote {
  return typeof (n as HoldNote).Duration === 'number';
}

let counter = 0;
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `n_${Date.now().toString(36)}_${counter}`;
}

export function stripId<T extends { id?: string }>(n: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = n;
  return rest;
}

// Mirror a lane across the center of the playfield. For LANE_RANGE 2..5: 2↔5, 3↔4.
// Generalizes if LANE_RANGE widens (TODO(lanes-1-6)) since it uses the range bounds.
export function mirrorLane(lane: number): number {
  return LANE_RANGE.min + LANE_RANGE.max - lane;
}
