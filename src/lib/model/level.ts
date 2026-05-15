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

// Editor-only timeline annotation. Never leaves the editor: stripped on export (it isn't part
// of the chart format the loader reads) and tolerated-as-missing on import. Drafts preserve it
// because the in-memory level shape is what gets serialized to localStorage.
export interface Marker {
  Tick: number;
  Label: string;
  Note?: string;
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
  // Editor-only; see Marker. Optional so existing drafts/imports without it stay valid.
  Markers?: Marker[];
}

export function emptyLevel(musicInfoName: string, level: number, musicPath: string): LevelJson {
  return {
    Version: 1,
    MusicInfoName: musicInfoName,
    Level: level,
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
    Markers: [],
  };
}
