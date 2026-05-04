import type { SongJson } from '../model/song';
import type { LevelJson } from '../model/level';
import { SUPPORTED_LEVELS } from '../model/level';
import { LANE_RANGE } from '../model/notes';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

const REQUIRED_SONG_FIELDS: (keyof SongJson)[] = [
  'ID', 'Audio', 'Title', 'Artist', 'Lyricist', 'Composer', 'Arranger', 'Levels',
];

// Block export when these fail. The loader rejects nulls/missing via reflection.
export function validateForExport(
  song: SongJson,
  levels: Map<string, LevelJson>,
  hasAudio: boolean,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const k of REQUIRED_SONG_FIELDS) {
    const v = song[k];
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      issues.push({ severity: 'error', message: `song.json: ${k} is empty` });
    }
  }
  if (!Array.isArray(song.Levels) || song.Levels.length === 0) {
    issues.push({ severity: 'error', message: 'song.json: at least one level required' });
  }
  if (!hasAudio) {
    issues.push({ severity: 'error', message: 'audio: no .ogg file loaded' });
  }

  for (const ref of song.Levels ?? []) {
    if (!ref.Path) {
      issues.push({ severity: 'error', message: 'song.json: level entry missing Path' });
      continue;
    }
    const lvl = levels.get(ref.Path);
    if (!lvl) {
      issues.push({ severity: 'error', message: `level "${ref.Path}" not found` });
      continue;
    }
    if (lvl.MusicInfoName !== song.ID) {
      issues.push({
        severity: 'error',
        message: `${ref.Path}: MusicInfoName "${lvl.MusicInfoName}" must equal song.ID "${song.ID}"`,
      });
    }
    if (!ref.Editor || ref.Editor.trim() === '') {
      issues.push({ severity: 'error', message: `level entry for ${ref.Path}: Editor is empty` });
    }
  }

  for (const [path, lvl] of levels) {
    if (
      typeof lvl.Level === 'number' &&
      !(SUPPORTED_LEVELS as readonly number[]).includes(lvl.Level)
    ) {
      issues.push({
        severity: 'warning',
        message: `${path}: Level ${lvl.Level} is outside the slots the game currently surfaces (${SUPPORTED_LEVELS.join(', ')}) — the file will load but won't appear in-game`,
      });
    }
  }

  return issues;
}

// Soft warnings (don't block import). Engine constraints we know about.
export function validateLevelEngine(level: LevelJson, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inLane = (l: number) => l >= LANE_RANGE.min && l <= LANE_RANGE.max;

  for (const n of level.SingleNotes ?? []) {
    if (!inLane(n.Lane)) {
      issues.push({ severity: 'warning', message: `${path}: SingleNote on lane ${n.Lane} (v1 supports ${LANE_RANGE.min}..${LANE_RANGE.max})` });
    }
  }
  for (const n of level.HoldNotes ?? []) {
    if (!inLane(n.Lane)) {
      issues.push({ severity: 'warning', message: `${path}: HoldNote on lane ${n.Lane}` });
    }
    if (n.Duration <= 0) {
      issues.push({ severity: 'warning', message: `${path}: HoldNote at tick ${n.Tick} has Duration ${n.Duration}` });
    }
  }
  for (const n of level.RushNotes ?? []) {
    // Rush spans Lane and Lane+1 — left lane must allow that.
    if (n.Lane < LANE_RANGE.min || n.Lane + 1 > LANE_RANGE.max) {
      issues.push({ severity: 'warning', message: `${path}: RushNote at lane ${n.Lane} extends outside ${LANE_RANGE.min}..${LANE_RANGE.max}` });
    }
    if (n.Duration <= 0) {
      issues.push({ severity: 'warning', message: `${path}: RushNote at tick ${n.Tick} has Duration ${n.Duration}` });
    }
  }

  if (!level.InitBpm || level.InitBpm.Bpm <= 0 || level.InitBpm.Bpm > 500) {
    issues.push({ severity: 'warning', message: `${path}: InitBpm ${level.InitBpm?.Bpm ?? '(missing)'} outside (0, 500]` });
  }

  return issues;
}
