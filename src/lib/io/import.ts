import JSZip from 'jszip';
import type { SongJson } from '../model/song';
import type { LevelJson } from '../model/level';
import { newId } from '../model/notes';
import { validateLevelEngine, type ValidationIssue } from './validate';

export interface ImportedMod {
  song: SongJson;
  levels: Map<string, LevelJson>;
  audio: { filename: string; mime: string; bytes: ArrayBuffer };
  modFolderName: string;
  warnings: ValidationIssue[];
}

export class ImportError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.issues = issues.length > 0 ? issues : [{ severity: 'error', message }];
  }
}

export async function parseZip(file: File | Blob): Promise<ImportedMod> {
  const zip = await JSZip.loadAsync(file);

  // Find song.json — search recursively, take shallowest match (handles parent-folder zips).
  let songPath: string | null = null;
  let songDepth = Number.POSITIVE_INFINITY;
  zip.forEach((relativePath) => {
    // Match the literal filename only — naive endsWith would also pick up "mysong.json".
    if (relativePath === 'song.json' || relativePath.endsWith('/song.json')) {
      const depth = relativePath.split('/').filter(Boolean).length;
      if (depth < songDepth) {
        songDepth = depth;
        songPath = relativePath;
      }
    }
  });
  if (!songPath) throw new ImportError('song.json not found in zip');

  const songFile = zip.file(songPath);
  if (!songFile) throw new ImportError('song.json found but unreadable');
  const songText = await songFile.async('string');
  const song = parseSongJson(songText);

  // Compute the directory containing song.json — level paths and audio path resolve relative to it.
  const baseDir = (songPath as string).slice(0, (songPath as string).length - 'song.json'.length);
  const modFolderName = baseDir
    ? baseDir.replace(/\/+$/, '').split('/').pop() || song.ID || 'mod'
    : song.ID || 'mod';

  const levels = new Map<string, LevelJson>();
  const warnings: ValidationIssue[] = [];

  const seen = new Set<string>();
  for (const ref of song.Levels) {
    if (seen.has(ref.Path)) continue;
    seen.add(ref.Path);

    const fullPath = baseDir + ref.Path;
    const lf = zip.file(fullPath);
    if (!lf) {
      warnings.push({ severity: 'warning', message: `level file "${ref.Path}" not found in zip` });
      continue;
    }
    const txt = await lf.async('string');
    const lvl = parseLevelJson(txt);
    levels.set(ref.Path, lvl);
    warnings.push(...validateLevelEngine(lvl, ref.Path));
  }

  // Audio: required for a usable import. If missing, throw — caller can still keep partial data via the song/levels.
  const audioFullPath = baseDir + song.Audio;
  const audioEntry = zip.file(audioFullPath);
  if (!audioEntry) throw new ImportError(`audio file "${song.Audio}" not found in zip`);
  const audioBytes = await audioEntry.async('arraybuffer');

  return {
    song,
    levels,
    audio: {
      filename: song.Audio,
      mime: 'audio/ogg',
      bytes: audioBytes,
    },
    modFolderName,
    warnings,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseSongJson(text: string): SongJson {
  const raw = JSON.parse(text);
  if (!isPlainObject(raw)) {
    throw new ImportError('song.json: expected a JSON object');
  }
  // Validate required fields with the right shape so downstream code can rely on them.
  // The loader rejects null/missing fields via reflection; mirror that here so the editor
  // doesn't crash later when consumers dereference these.
  for (const k of ['ID', 'Audio', 'Title', 'Artist', 'Lyricist', 'Composer', 'Arranger']) {
    if (typeof raw[k] !== 'string') {
      throw new ImportError(`song.json: "${k}" must be a string`);
    }
  }
  if (!Array.isArray(raw.Levels)) {
    throw new ImportError('song.json: "Levels" must be an array');
  }
  for (let i = 0; i < raw.Levels.length; i++) {
    const ref = raw.Levels[i];
    if (!isPlainObject(ref)) throw new ImportError(`song.json: Levels[${i}] must be an object`);
    if (typeof ref.Editor !== 'string') throw new ImportError(`song.json: Levels[${i}].Editor must be a string`);
    if (typeof ref.Difficulty !== 'number') throw new ImportError(`song.json: Levels[${i}].Difficulty must be a number`);
    if (typeof ref.Path !== 'string') throw new ImportError(`song.json: Levels[${i}].Path must be a string`);
  }
  return raw as unknown as SongJson;
}

function asTickedNumber(v: unknown, fallbackTick: number, fallbackValue: number, key: string): { Tick: number; Value: number } {
  if (!isPlainObject(v)) return { Tick: fallbackTick, Value: fallbackValue };
  const tick = typeof v.Tick === 'number' && Number.isFinite(v.Tick) ? v.Tick : fallbackTick;
  const value = typeof v[key] === 'number' && Number.isFinite(v[key] as number) ? (v[key] as number) : fallbackValue;
  return { Tick: tick, Value: value };
}

export function parseLevelJson(text: string): LevelJson {
  const parsed = JSON.parse(text);
  if (!isPlainObject(parsed)) {
    throw new ImportError('level: expected a JSON object');
  }
  const raw = parsed as Partial<LevelJson> & Record<string, unknown>;
  // Coerce missing/null arrays to []. Hand-edited or third-party files may omit fields,
  // and a TypeError mid-iteration would kill the whole import with no recovery.
  raw.SingleNotes = Array.isArray(raw.SingleNotes) ? raw.SingleNotes : [];
  raw.HoldNotes = Array.isArray(raw.HoldNotes) ? raw.HoldNotes : [];
  raw.ShiftNotes = Array.isArray(raw.ShiftNotes) ? raw.ShiftNotes : [];
  raw.RushNotes = Array.isArray(raw.RushNotes) ? raw.RushNotes : [];
  raw.BpmChangeEvents = Array.isArray(raw.BpmChangeEvents) ? raw.BpmChangeEvents : [];
  raw.TimeSignature = Array.isArray(raw.TimeSignature) ? raw.TimeSignature : [];
  raw.PhaseChangeEvents = Array.isArray(raw.PhaseChangeEvents) ? raw.PhaseChangeEvents : [];
  // InitBpm and InitTimeSignature are dereferenced unconditionally during rendering; a
  // malformed level missing either would throw deep in the canvas/timing layer. Default
  // to sane values so the editor stays responsive — any garbage is visible in the panel.
  if (!isPlainObject(raw.InitBpm)) {
    raw.InitBpm = { Tick: 0, Bpm: 120 };
  } else {
    const init = asTickedNumber(raw.InitBpm, 0, 120, 'Bpm');
    raw.InitBpm = { Tick: init.Tick, Bpm: init.Value };
  }
  if (!isPlainObject(raw.InitTimeSignature)) {
    raw.InitTimeSignature = { Tick: 0, Numerator: 4, Denominator: 4 };
  } else {
    const ts = raw.InitTimeSignature as Record<string, unknown>;
    const tick = typeof ts.Tick === 'number' && Number.isFinite(ts.Tick) ? ts.Tick : 0;
    const num = typeof ts.Numerator === 'number' && Number.isFinite(ts.Numerator) && ts.Numerator >= 1 ? ts.Numerator : 4;
    const den = typeof ts.Denominator === 'number' && Number.isFinite(ts.Denominator) && ts.Denominator >= 1 ? ts.Denominator : 4;
    raw.InitTimeSignature = { Tick: tick, Numerator: num, Denominator: den };
  }
  // mostRecentTsTick() and the bar-line walker assume timing event arrays are sorted by Tick.
  // Hand-edited or third-party files may not be — sort defensively on import.
  (raw.BpmChangeEvents as { Tick: number }[]).sort((a, b) => a.Tick - b.Tick);
  (raw.TimeSignature as { Tick: number }[]).sort((a, b) => a.Tick - b.Tick);
  (raw.PhaseChangeEvents as { Tick: number }[]).sort((a, b) => a.Tick - b.Tick);
  // Assign in-memory ids for stable selection. ShiftNotes get them too in case lanes 1/6 ever become editable.
  for (const n of raw.SingleNotes) n.id = newId();
  for (const n of raw.HoldNotes) n.id = newId();
  for (const n of raw.ShiftNotes) n.id = newId();
  for (const n of raw.RushNotes) n.id = newId();
  return raw as LevelJson;
}
