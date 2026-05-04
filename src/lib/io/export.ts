import JSZip from 'jszip';
import type { SongJson } from '../model/song';
import type { LevelJson } from '../model/level';
import { stripId } from '../model/notes';
import { validateForExport, type ValidationIssue } from './validate';

export interface ExportInput {
  song: SongJson;
  // Keyed by level Path (matches each Levels[].Path entry).
  levels: Map<string, LevelJson>;
  audio: { filename: string; bytes: ArrayBuffer } | null;
  modFolderName: string;
}

export interface ExportResult {
  ok: true;
  blob: Blob;
  filename: string;
}

export interface ExportError {
  ok: false;
  issues: ValidationIssue[];
}

export async function buildZip(input: ExportInput): Promise<ExportResult | ExportError> {
  const issues = validateForExport(input.song, input.levels, input.audio !== null);
  const errors = issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) return { ok: false, issues };

  const zip = new JSZip();
  const dir = zip.folder(input.modFolderName);
  if (!dir) throw new Error('zip folder creation failed');

  dir.file('song.json', stringifySong(input.song));

  const written = new Set<string>();
  for (const ref of input.song.Levels) {
    if (written.has(ref.Path)) continue;
    written.add(ref.Path);
    const lvl = input.levels.get(ref.Path);
    if (!lvl) continue; // already an error above
    dir.file(ref.Path, stringifyLevel(lvl));
  }

  if (input.audio) {
    dir.file(input.song.Audio || input.audio.filename, input.audio.bytes);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { ok: true, blob, filename: `${input.modFolderName}.zip` };
}

export function stringifySong(song: SongJson): string {
  return stringifyJsonWithDoubles(song, '\t') + '\n';
}

export function stringifyLevel(level: LevelJson): string {
  // Strip in-memory uuids and force ShiftNotes to []. v1 doesn't edit ShiftNotes; preserving
  // imported contents would contradict the documented contract (PLAN.md: "always emit []").
  // TODO(shift-notes): widen when v2 exposes ShiftNote editing.
  const out = {
    ...level,
    SingleNotes: level.SingleNotes.map(stripId),
    HoldNotes: level.HoldNotes.map(stripId),
    ShiftNotes: [],
    RushNotes: level.RushNotes.map(stripId),
  };
  return stringifyJsonWithDoubles(out, '\t') + '\n';
}

// The loader treats Bpm and ScoreOffset as `double`. JS collapses `120.0` to the integer 120 on
// parse, and JSON.stringify emits `120` — which would diverge byte-for-byte from a hand-written
// chart. Round-trip the trailing `.0` so a re-export of the bundled Example matches the source.
const DOUBLE_FIELDS = new Set(['Bpm', 'ScoreOffset']);
const DOUBLE_PLACEHOLDER = '__YYDOUBLE_';

function stringifyJsonWithDoubles(obj: unknown, indent: string): string {
  const json = JSON.stringify(
    obj,
    (key, value) => {
      if (DOUBLE_FIELDS.has(key) && typeof value === 'number' && Number.isInteger(value)) {
        return `${DOUBLE_PLACEHOLDER}${value}__`;
      }
      return value;
    },
    indent,
  );
  return json.replace(new RegExp(`"${DOUBLE_PLACEHOLDER}(-?\\d+)__"`, 'g'), '$1.0');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadBytes(bytes: ArrayBuffer, filename: string, mime = 'application/octet-stream'): void {
  downloadBlob(new Blob([bytes], { type: mime }), filename);
}

export function sanitizeFolderName(raw: string): string {
  const trimmed = raw.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
  return trimmed || 'mod';
}
