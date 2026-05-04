import type { SongJson } from '../model/song';
import type { LevelJson } from '../model/level';
import { stripId } from '../model/notes';
import { newId } from '../model/notes';
import { deleteAudio } from './audioStore';

const INDEX_KEY = 'yyedit.drafts.v1';
const CHART_KEY = (id: string) => `yyedit.draft.${id}.chart`;

export interface DraftMeta {
  id: string;
  name: string;
  updatedAt: number;
  songId: string;
}

export interface DraftChart {
  song: SongJson;
  // levels keyed by Path
  levels: Record<string, LevelJson>;
}

export function listDrafts(): DraftMeta[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DraftMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(items: DraftMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items));
}

export function readDraft(id: string): DraftChart | null {
  const raw = localStorage.getItem(CHART_KEY(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftChart;
  } catch {
    return null;
  }
}

export function writeDraft(id: string, chart: DraftChart): void {
  // Strip in-memory uuids before writing to localStorage so a reload doesn't drift ids around.
  const cleaned: DraftChart = {
    song: chart.song,
    levels: Object.fromEntries(
      Object.entries(chart.levels).map(([k, lvl]) => [
        k,
        {
          ...lvl,
          SingleNotes: lvl.SingleNotes.map(stripId),
          HoldNotes: lvl.HoldNotes.map(stripId),
          ShiftNotes: lvl.ShiftNotes.map(stripId),
          RushNotes: lvl.RushNotes.map(stripId),
        },
      ]),
    ) as DraftChart['levels'],
  };
  localStorage.setItem(CHART_KEY(id), JSON.stringify(cleaned));
}

export function reassignNoteIds(chart: DraftChart): DraftChart {
  for (const lvl of Object.values(chart.levels)) {
    for (const n of lvl.SingleNotes) n.id = newId();
    for (const n of lvl.HoldNotes) n.id = newId();
    for (const n of lvl.ShiftNotes) n.id = newId();
    for (const n of lvl.RushNotes) n.id = newId();
  }
  return chart;
}

export function upsertDraftMeta(meta: DraftMeta): void {
  const all = listDrafts();
  const i = all.findIndex((d) => d.id === meta.id);
  if (i >= 0) all[i] = meta;
  else all.push(meta);
  writeIndex(all);
}

export async function deleteDraft(id: string): Promise<void> {
  const all = listDrafts().filter((d) => d.id !== id);
  writeIndex(all);
  localStorage.removeItem(CHART_KEY(id));
  await deleteAudio(id).catch(() => undefined);
}

// "Current" is the always-live working draft. Survives reload even if the user never explicitly saves.
export const CURRENT_ID = '__current__';

export function readCurrent(): DraftChart | null {
  return readDraft(CURRENT_ID);
}

export function writeCurrent(chart: DraftChart): void {
  writeDraft(CURRENT_ID, chart);
}

export function newDraftId(): string {
  return newId();
}

export const DRAFT_LIMIT = 20;
