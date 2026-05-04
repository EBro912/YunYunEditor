import { writable, derived, get, type Readable } from 'svelte/store';
import type { SongJson } from '../model/song';
import { emptySong } from '../model/song';
import type { LevelJson } from '../model/level';
import { emptyLevel } from '../model/level';
import { newId } from '../model/notes';
import { clearSelection } from './editorStore';
import type { ImportedMod } from '../io/import';

export interface ChartState {
  song: SongJson;
  // levels keyed by Path (matches each Levels[].Path entry)
  levels: Record<string, LevelJson>;
  activeLevelPath: string | null;
}

const initial: ChartState = {
  song: emptySong(),
  levels: {},
  activeLevelPath: null,
};

export const chart = writable<ChartState>(initial);

// Bumped on every mutation; the autosave layer subscribes to this rather than to the deep state.
export const dirtyTick = writable(0);
function bump() {
  dirtyTick.update((n) => n + 1);
}

export const activeLevel: Readable<LevelJson | null> = derived(chart, ($c) => {
  if (!$c.activeLevelPath) return null;
  return $c.levels[$c.activeLevelPath] ?? null;
});

export function setChart(next: ChartState): void {
  // Selection holds note ids from the previous chart; they don't apply to the new one.
  clearSelection();
  chart.set(next);
  bump();
}

export function loadFromImport(mod: ImportedMod): void {
  const levels: Record<string, LevelJson> = {};
  for (const [k, v] of mod.levels) levels[k] = v;
  const firstPath = mod.song.Levels[0]?.Path ?? null;
  setChart({ song: mod.song, levels, activeLevelPath: firstPath });
}

export function setActiveLevel(path: string): void {
  // Selection ids are scoped to the level they came from; clear on switch.
  clearSelection();
  chart.update((c) => ({ ...c, activeLevelPath: path }));
}

// Levels denormalize song.ID into MusicInfoName and song.Audio (sans `.ogg`) into MusicPath —
// see Example/level1.json. The loader requires the two pairs to match exactly, so any caller
// that touches song.ID or song.Audio must funnel through updateSong to keep levels in sync.
function audioToMusicPath(audio: string): string {
  return audio.replace(/\.ogg$/i, '');
}

export function updateSong(patch: Partial<SongJson>): void {
  chart.update((c) => {
    const nextSong = { ...c.song, ...patch };
    const idChanged = nextSong.ID !== c.song.ID;
    const audioChanged = nextSong.Audio !== c.song.Audio;
    if (!idChanged && !audioChanged) {
      return { ...c, song: nextSong };
    }
    const musicPath = audioToMusicPath(nextSong.Audio);
    const nextLevels: Record<string, LevelJson> = {};
    for (const [path, lvl] of Object.entries(c.levels)) {
      nextLevels[path] = {
        ...lvl,
        ...(idChanged ? { MusicInfoName: nextSong.ID } : {}),
        ...(audioChanged ? { MusicPath: musicPath } : {}),
      };
    }
    return { ...c, song: nextSong, levels: nextLevels };
  });
  bump();
}

export function addLevel(editor: string, difficulty: number): void {
  const c = get(chart);
  const id = newId().slice(0, 6);
  const path = `level_${id}.json`;
  // No fallback strings — an empty song.ID/Audio must produce an empty MusicInfoName/MusicPath
  // so the level stays consistent with the song. Export validation already blocks empty fields.
  const lvl = emptyLevel(c.song.ID, difficulty, audioToMusicPath(c.song.Audio));
  chart.update((s) => ({
    ...s,
    song: {
      ...s.song,
      Levels: [...s.song.Levels, { Editor: editor, Difficulty: difficulty, Path: path }],
    },
    levels: { ...s.levels, [path]: lvl },
    activeLevelPath: path,
  }));
  bump();
}

export function removeLevelRefAt(idx: number): void {
  chart.update((s) => {
    const ref = s.song.Levels[idx];
    if (!ref) return s;
    const nextRefs = s.song.Levels.filter((_, i) => i !== idx);
    const stillReferenced = nextRefs.some((r) => r.Path === ref.Path);
    const nextLevels = { ...s.levels };
    if (!stillReferenced) delete nextLevels[ref.Path];
    const nextActive =
      s.activeLevelPath && (stillReferenced || nextRefs.some((r) => r.Path === s.activeLevelPath))
        ? s.activeLevelPath
        : nextRefs[0]?.Path ?? null;
    return { ...s, song: { ...s.song, Levels: nextRefs }, levels: nextLevels, activeLevelPath: nextActive };
  });
  bump();
}

export function duplicateLevelRefAt(idx: number): void {
  const c = get(chart);
  const src = c.song.Levels[idx];
  if (!src) return;
  // Clone level data into a new Path so subsequent edits don't bleed into the source.
  const newPath = `level_${newId().slice(0, 6)}.json`;
  const srcLvl = c.levels[src.Path];
  const clone: LevelJson | undefined = srcLvl
    ? JSON.parse(JSON.stringify(srcLvl))
    : undefined;
  chart.update((s) => ({
    ...s,
    song: {
      ...s.song,
      Levels: [...s.song.Levels.slice(0, idx + 1), { ...src, Path: newPath }, ...s.song.Levels.slice(idx + 1)],
    },
    levels: clone ? { ...s.levels, [newPath]: { ...clone, MusicInfoName: s.song.ID } } : s.levels,
  }));
  bump();
}

export function patchLevelRef(idx: number, patch: Partial<{ Editor: string; Difficulty: number; Path: string }>): void {
  chart.update((s) => {
    const refs = s.song.Levels.slice();
    if (!refs[idx]) return s;
    refs[idx] = { ...refs[idx], ...patch };
    return { ...s, song: { ...s.song, Levels: refs } };
  });
  bump();
}

export function patchActiveLevel(patch: Partial<LevelJson>): void {
  chart.update((s) => {
    if (!s.activeLevelPath) return s;
    const cur = s.levels[s.activeLevelPath];
    if (!cur) return s;
    return {
      ...s,
      levels: { ...s.levels, [s.activeLevelPath]: { ...cur, ...patch } },
    };
  });
  bump();
}

export function mutateActiveLevel(fn: (lvl: LevelJson) => LevelJson): void {
  chart.update((s) => {
    if (!s.activeLevelPath) return s;
    const cur = s.levels[s.activeLevelPath];
    if (!cur) return s;
    return {
      ...s,
      levels: { ...s.levels, [s.activeLevelPath]: fn(cur) },
    };
  });
  bump();
}
