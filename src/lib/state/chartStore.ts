import { writable, derived, get, type Readable } from 'svelte/store';
import type { SongJson } from '../model/song';
import { emptySong } from '../model/song';
import type { LevelJson } from '../model/level';
import { emptyLevel, SUPPORTED_LEVELS } from '../model/level';
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
// Tracks whether the current chart contains unsaved work that a destructive load would clobber.
// Distinct from dirtyTick: that bumps on every change for autosave/redraw triggering, while this
// stays sticky-true until the work is preserved (named-draft save, fresh import, new project).
export const dirty = writable<boolean>(false);
function bump() {
  dirtyTick.update((n) => n + 1);
  dirty.set(true);
}

export function markClean(): void {
  dirty.set(false);
}

export function markDirty(): void {
  dirty.set(true);
}

export const activeLevel: Readable<LevelJson | null> = derived(chart, ($c) => {
  if (!$c.activeLevelPath) return null;
  return $c.levels[$c.activeLevelPath] ?? null;
});

export function setChart(next: ChartState, opts: { dirty?: boolean } = {}): void {
  // Selection holds note ids from the previous chart; they don't apply to the new one.
  clearSelection();
  chart.set(next);
  bump();
  // bump() leaves dirty=true; callers that are loading a clean snapshot (fresh import, named
  // draft load, newProject) override it back to false. The autoload-from-cache path passes
  // { dirty: true } so a subsequent draft load still triggers the confirmation prompt.
  dirty.set(opts.dirty ?? false);
}

export function loadFromImport(mod: ImportedMod, opts: { dirty?: boolean } = {}): void {
  const levels: Record<string, LevelJson> = {};
  for (const [k, v] of mod.levels) levels[k] = v;
  const firstPath = mod.song.Levels[0]?.Path ?? null;
  setChart({ song: mod.song, levels, activeLevelPath: firstPath }, opts);
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

// Returns false if `level` is already in use by another chart in this song. Caller is responsible
// for surfacing the rejection (the slot guard exists because the loader keys charts by Level slot).
export function addLevel(editor: string, level: number, difficulty: number): boolean {
  const c = get(chart);
  if (c.song.Levels.some((r) => c.levels[r.Path]?.Level === level)) return false;
  const id = newId().slice(0, 6);
  const path = `level_${id}.json`;
  // No fallback strings — an empty song.ID/Audio must produce an empty MusicInfoName/MusicPath
  // so the level stays consistent with the song. Export validation already blocks empty fields.
  const lvl = emptyLevel(c.song.ID, level, audioToMusicPath(c.song.Audio));
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
  return true;
}

export function removeLevelRefAt(idx: number): void {
  let activeChanged = false;
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
    activeChanged = nextActive !== s.activeLevelPath;
    return { ...s, song: { ...s.song, Levels: nextRefs }, levels: nextLevels, activeLevelPath: nextActive };
  });
  // Selection ids reference the level we just navigated away from; clear them so the next
  // mutation doesn't apply to whichever stray ids happen to match in the new active level.
  if (activeChanged) clearSelection();
  bump();
}

// Returns false when no SUPPORTED_LEVELS slot is free; the source slot would otherwise collide.
// Caller surfaces a message; we don't alert from the store.
export function duplicateLevelRefAt(idx: number): boolean {
  const c = get(chart);
  const src = c.song.Levels[idx];
  if (!src) return false;
  const usedSlots = new Set(
    Object.values(c.levels)
      .map((l) => l.Level)
      .filter((v): v is number => typeof v === 'number'),
  );
  const freeSlot = (SUPPORTED_LEVELS as readonly number[]).find((v) => !usedSlots.has(v));
  if (freeSlot === undefined) return false;
  // Clone level data into a new Path so subsequent edits don't bleed into the source.
  const newPath = `level_${newId().slice(0, 6)}.json`;
  const srcLvl = c.levels[src.Path];
  const clone: LevelJson | undefined = srcLvl
    ? JSON.parse(JSON.stringify(srcLvl))
    : undefined;
  if (clone) {
    // JSON.parse(JSON.stringify(...)) preserves the in-memory `id` field on each note, so the
    // cloned level would share ids with the source. A selection of either level would then
    // also "select" the clone's matching notes, and edits would silently apply to both.
    for (const n of clone.SingleNotes) n.id = newId();
    for (const n of clone.HoldNotes) n.id = newId();
    for (const n of clone.ShiftNotes) n.id = newId();
    for (const n of clone.RushNotes) n.id = newId();
    clone.Level = freeSlot;
  }
  chart.update((s) => ({
    ...s,
    song: {
      ...s.song,
      Levels: [...s.song.Levels.slice(0, idx + 1), { ...src, Path: newPath }, ...s.song.Levels.slice(idx + 1)],
    },
    levels: clone ? { ...s.levels, [newPath]: { ...clone, MusicInfoName: s.song.ID } } : s.levels,
  }));
  bump();
  return true;
}

export function patchLevelRef(idx: number, patch: Partial<{ Editor: string; Difficulty: number }>): void {
  chart.update((s) => {
    const refs = s.song.Levels.slice();
    if (!refs[idx]) return s;
    refs[idx] = { ...refs[idx], ...patch };
    return { ...s, song: { ...s.song, Levels: refs } };
  });
  bump();
}

// Slot lives on LevelJson.Level (not SongLevelRef). Returns false on no-op or slot collision.
export function setLevelSlotAt(idx: number, level: number): boolean {
  const c = get(chart);
  const ref = c.song.Levels[idx];
  if (!ref) return false;
  const cur = c.levels[ref.Path];
  if (!cur || cur.Level === level) return false;
  if (Object.entries(c.levels).some(([p, l]) => p !== ref.Path && l.Level === level)) return false;
  chart.update((s) => {
    const lvl = s.levels[ref.Path];
    if (!lvl) return s;
    return { ...s, levels: { ...s.levels, [ref.Path]: { ...lvl, Level: level } } };
  });
  bump();
  return true;
}

// Swap the Level slot of the chart at `idx` with whichever other chart currently holds `newLevel`.
// Returns false if there's no other chart at `newLevel` (in which case the caller should use
// setLevelSlotAt instead) or the index/data is missing.
export function swapLevelSlotAt(idx: number, newLevel: number): boolean {
  const c = get(chart);
  const ref = c.song.Levels[idx];
  if (!ref) return false;
  const cur = c.levels[ref.Path];
  if (!cur || cur.Level === newLevel) return false;
  const otherEntry = Object.entries(c.levels).find(
    ([p, l]) => p !== ref.Path && l.Level === newLevel,
  );
  if (!otherEntry) return false;
  const [otherPath] = otherEntry;
  const oldLevel = cur.Level;
  chart.update((s) => {
    const a = s.levels[ref.Path];
    const b = s.levels[otherPath];
    if (!a || !b) return s;
    return {
      ...s,
      levels: {
        ...s.levels,
        [ref.Path]: { ...a, Level: newLevel },
        [otherPath]: { ...b, Level: oldLevel },
      },
    };
  });
  bump();
  return true;
}

// Atomic Path rename: a free-form Path patch would leave `levels` keyed by the old path,
// orphaning the level data and breaking the active-level resolver. Move the data to the new key,
// update activeLevelPath, and reject duplicates / empty paths.
export function renameLevelRef(idx: number, newPath: string): boolean {
  let ok = false;
  chart.update((s) => {
    const ref = s.song.Levels[idx];
    if (!ref) return s;
    const trimmed = newPath.trim();
    if (!trimmed || trimmed === ref.Path) return s;
    // Two refs sharing a Path means they share level data; reject a rename that would
    // collide with another ref because we'd silently merge or clobber the target.
    if (s.song.Levels.some((r, i) => i !== idx && r.Path === trimmed)) return s;
    const oldPath = ref.Path;
    const refs = s.song.Levels.slice();
    refs[idx] = { ...refs[idx], Path: trimmed };
    const nextLevels = { ...s.levels };
    const lvl = nextLevels[oldPath];
    if (lvl) {
      nextLevels[trimmed] = lvl;
      // Mirror removeLevelRefAt: only drop the old key when no other ref still uses it.
      const stillReferenced = refs.some((r) => r.Path === oldPath);
      if (!stillReferenced) delete nextLevels[oldPath];
    }
    const nextActive = s.activeLevelPath === oldPath ? trimmed : s.activeLevelPath;
    ok = true;
    return { ...s, song: { ...s.song, Levels: refs }, levels: nextLevels, activeLevelPath: nextActive };
  });
  if (ok) bump();
  return ok;
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
