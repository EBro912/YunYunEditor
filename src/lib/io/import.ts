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

export function parseSongJson(text: string): SongJson {
  const raw = JSON.parse(text);
  // Trust the contract — the loader doesn't add forgiveness, so we don't either.
  return raw as SongJson;
}

export function parseLevelJson(text: string): LevelJson {
  const raw = JSON.parse(text) as Partial<LevelJson> & Record<string, unknown>;
  // Coerce missing/null arrays to []. Hand-edited or third-party files may omit fields,
  // and a TypeError mid-iteration would kill the whole import with no recovery.
  raw.SingleNotes = Array.isArray(raw.SingleNotes) ? raw.SingleNotes : [];
  raw.HoldNotes = Array.isArray(raw.HoldNotes) ? raw.HoldNotes : [];
  raw.ShiftNotes = Array.isArray(raw.ShiftNotes) ? raw.ShiftNotes : [];
  raw.RushNotes = Array.isArray(raw.RushNotes) ? raw.RushNotes : [];
  raw.BpmChangeEvents = Array.isArray(raw.BpmChangeEvents) ? raw.BpmChangeEvents : [];
  raw.TimeSignature = Array.isArray(raw.TimeSignature) ? raw.TimeSignature : [];
  raw.PhaseChangeEvents = Array.isArray(raw.PhaseChangeEvents) ? raw.PhaseChangeEvents : [];
  // Assign in-memory ids for stable selection. ShiftNotes get them too in case lanes 1/6 ever become editable.
  for (const n of raw.SingleNotes) n.id = newId();
  for (const n of raw.HoldNotes) n.id = newId();
  for (const n of raw.ShiftNotes) n.id = newId();
  for (const n of raw.RushNotes) n.id = newId();
  return raw as LevelJson;
}
