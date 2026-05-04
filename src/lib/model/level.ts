// Mirrors YYNoteEditor.ScoreData.cs.
// TPQN = 480 ticks per quarter note (a hard contract — see Decomp/.../ScoreData.cs).

import type { HoldNote, RushNote, SingleNote, ShiftNote } from './notes';

// TODO(custom-levels): widen if/when the game adds free-form level slots.
export const SUPPORTED_LEVELS = [1, 3, 4, 5] as const;

export interface BpmEvent {
  Tick: number;
  Bpm: number;
}

export interface TimeSignatureEvent {
  Tick: number;
  Numerator: number;
  Denominator: number;
}

export interface PhaseEvent {
  Tick: number;
}

export interface LevelJson {
  Version: 1;
  MusicInfoName: string;
  Level: number;
  MusicPath: string;
  ScoreOffset: number;
  InitBpm: BpmEvent;
  InitTimeSignature: TimeSignatureEvent;
  BpmChangeEvents: BpmEvent[];
  TimeSignature: TimeSignatureEvent[];
  PhaseChangeEvents: PhaseEvent[];
  SingleNotes: SingleNote[];
  HoldNotes: HoldNote[];
  ShiftNotes: ShiftNote[];
  RushNotes: RushNote[];
}

export function emptyLevel(musicInfoName: string, difficulty: number, musicPath: string): LevelJson {
  return {
    Version: 1,
    MusicInfoName: musicInfoName,
    Level: difficulty,
    MusicPath: musicPath,
    ScoreOffset: 0,
    InitBpm: { Tick: 0, Bpm: 120 },
    InitTimeSignature: { Tick: 0, Numerator: 4, Denominator: 4 },
    BpmChangeEvents: [],
    TimeSignature: [],
    PhaseChangeEvents: [],
    SingleNotes: [],
    HoldNotes: [],
    ShiftNotes: [],
    RushNotes: [],
  };
}
