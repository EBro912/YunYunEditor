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

// JSZip writes paths verbatim, so unchecked refs like "../foo.json" or "/abs/path.json" can
// produce archives with unsafe or non-portable entries. Reject anything that's not a plain
// relative filename in a single segment.
function isSafeRelativeFilename(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name.length > 255) return false;
  if (name === '.' || name === '..') return false;
  // Disallow path separators, absolute markers, and Windows-reserved chars/drive prefixes.
  if (/[\\/]/.test(name)) return false;
  if (/^[A-Za-z]:/.test(name)) return false;
  if (/[<>:"|?*]/.test(name)) return false;
  for (let i = 0; i < name.length; i++) if (name.charCodeAt(i) < 0x20) return false;
  // Disallow leading/trailing whitespace or trailing dots (Windows trims them silently).
  if (name !== name.trim()) return false;
  if (name.endsWith('.')) return false;
  // Windows reserved device names — case-insensitive, with or without an extension.
  const stem = name.split('.')[0].toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem)) return false;
  return true;
}

function hasExtension(name: string, ext: string): boolean {
  return name.toLowerCase().endsWith(ext.toLowerCase());
}

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

  const seenPaths = new Set<string>();
  for (const ref of song.Levels ?? []) {
    if (!ref.Path) {
      issues.push({ severity: 'error', message: 'song.json: level entry missing Path' });
      continue;
    }
    if (!isSafeRelativeFilename(ref.Path)) {
      issues.push({
        severity: 'error',
        message: `level path "${ref.Path}" is not a safe relative filename (no separators, parent refs, or reserved names)`,
      });
      continue;
    }
    if (!hasExtension(ref.Path, '.json')) {
      issues.push({ severity: 'error', message: `level path "${ref.Path}" must end with .json` });
      continue;
    }
    if (ref.Path.toLowerCase() === 'song.json') {
      issues.push({ severity: 'error', message: `level path "${ref.Path}" collides with song.json` });
      continue;
    }
    const lcPath = ref.Path.toLowerCase();
    if (seenPaths.has(lcPath)) {
      issues.push({ severity: 'error', message: `level path "${ref.Path}" duplicates another entry (case-insensitive)` });
      continue;
    }
    seenPaths.add(lcPath);
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
    // The loader resolves audio by stitching MusicPath + ".ogg"; if it doesn't match song.Audio
    // verbatim (sans extension), the level loads but plays no sound. updateSong() keeps the two
    // in sync for in-app edits, but imported or hand-edited levels can carry a stale MusicPath.
    const expectedMusicPath = song.Audio.replace(/\.ogg$/i, '');
    if (lvl.MusicPath !== expectedMusicPath) {
      issues.push({
        severity: 'error',
        message: `${ref.Path}: MusicPath "${lvl.MusicPath}" must equal song.Audio without .ogg ("${expectedMusicPath}")`,
      });
    }
    if (!ref.Editor || ref.Editor.trim() === '') {
      issues.push({ severity: 'error', message: `level entry for ${ref.Path}: Editor is empty` });
    }
  }

  if (song.Audio) {
    if (!isSafeRelativeFilename(song.Audio)) {
      issues.push({
        severity: 'error',
        message: `audio filename "${song.Audio}" is not a safe relative filename`,
      });
    } else if (!hasExtension(song.Audio, '.ogg')) {
      issues.push({ severity: 'error', message: `audio filename "${song.Audio}" must end with .ogg` });
    } else if (song.Audio.toLowerCase() === 'song.json') {
      issues.push({ severity: 'error', message: `audio filename collides with song.json` });
    } else if (seenPaths.has(song.Audio.toLowerCase())) {
      issues.push({
        severity: 'error',
        message: `audio filename "${song.Audio}" collides with a level path`,
      });
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
