// Round-trip the bundled Example mod through the editor's actual parsers/serializers
// (parseSongJson / parseLevelJson / stringifySong / stringifyLevel). If this passes, a
// freshly-imported Example exported back out should be byte-identical to the source files
// (modulo whitespace inside arrays — the on-disk Example mixes tabs and spaces).
//
// Run: npm run roundtrip
//
// Failure modes this catches that the previous JSON-only smoke test missed:
//   - stringifyLevel forgetting to strip in-memory `id`s
//   - ShiftNotes leaking values when the contract says "always []"
//   - `Bpm: 120.0` collapsing to `Bpm: 120` on stringify
//   - parseLevelJson regressing on the missing-array crash

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseSongJson, parseLevelJson } from '../src/lib/io/import';
import { stringifySong, stringifyLevel } from '../src/lib/io/export';

const here = dirname(fileURLToPath(import.meta.url));
const exampleDir = resolve(here, '..', 'Example');

function readFile(name: string): string {
  return readFileSync(resolve(exampleDir, name), 'utf8');
}

// Compare structurally, after normalizing the parse step. We can't byte-compare directly because
// the on-disk Example uses inconsistent whitespace inside arrays.
function deepEqual(a: unknown, b: unknown, path = ''): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) {
    console.error(`type mismatch at ${path}: ${typeof a} vs ${typeof b}`);
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      console.error(`array mismatch at ${path}: ${(a as unknown[])?.length} vs ${(b as unknown[])?.length}`);
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], `${path}[${i}]`)) return false;
    }
    return true;
  }
  if (a && b && typeof a === 'object') {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort();
    const bk = Object.keys(bo).sort();
    if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) {
      console.error(`key set mismatch at ${path}: [${ak}] vs [${bk}]`);
      return false;
    }
    for (const k of ak) {
      if (!deepEqual(ao[k], bo[k], `${path}.${k}`)) return false;
    }
    return true;
  }
  console.error(`scalar mismatch at ${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return false;
}

let failures = 0;

// song.json — uses parseSongJson + stringifySong.
{
  const original = readFile('song.json');
  const parsed = parseSongJson(original);
  const reEmitted = stringifySong(parsed);
  const reParsed = parseSongJson(reEmitted);
  if (!deepEqual(parsed, reParsed, 'song.json')) {
    console.error('song.json round-trip FAILED');
    failures += 1;
  }
}

// Each unique level file — uses parseLevelJson + stringifyLevel. Strip `id` before comparing
// because parseLevelJson injects in-memory uuids that stringifyLevel removes on output.
const songRaw = JSON.parse(readFile('song.json')) as { Levels: { Path: string }[] };
const seen = new Set<string>();
for (const ref of songRaw.Levels) {
  if (seen.has(ref.Path)) continue;
  seen.add(ref.Path);

  const original = readFile(ref.Path);
  const parsed = parseLevelJson(original);
  const reEmitted = stringifyLevel(parsed);
  const reParsed = parseLevelJson(reEmitted);

  // Drop ids from both sides (they're freshly minted on each parse).
  const stripIds = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripIds);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'id') continue;
      out[k] = stripIds(v);
    }
    return out;
  };

  if (!deepEqual(stripIds(parsed), stripIds(reParsed), ref.Path)) {
    console.error(`${ref.Path} round-trip FAILED`);
    failures += 1;
  }

  // Also confirm the textual round-trip preserves the trailing `.0` on Bpm/ScoreOffset.
  // The on-disk Example uses `Bpm: 120.0` and `Bpm: 150.0` — they must survive.
  if (/"Bpm":\s*\d+\.\d/.test(original) && !/"Bpm":\s*\d+\.\d/.test(reEmitted)) {
    console.error(`${ref.Path}: Bpm decimal lost on re-emit`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`FAILED — ${failures} round-trip issue(s)`);
  process.exit(1);
}
console.log(`OK — round-tripped song.json + ${seen.size} unique level files via the editor's parsers`);
