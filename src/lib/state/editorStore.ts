import { writable } from 'svelte/store';
import type { SnapDivision } from '../timing/snap';

export type Tool = 'single' | 'hold' | 'rush' | 'eraser' | 'select';

export interface EditorState {
  tool: Tool;
  snapEnabled: boolean;
  snapDivision: SnapDivision;
  pixelsPerSecond: number;
  selection: Set<string>; // note ids
  playheadTick: number;
  audioReady: boolean;
  // Behavior toggles surfaced in the Options panel. Persisted to localStorage so they survive reload.
  preventDuplicates: boolean;
  lockNotes: boolean;
  mirrorPlacement: boolean;
  offsetInMs: boolean;
  playbackRate: number;
  // v0.4.0 playback FX + display. metronome/hitSounds gate the lookahead scheduler; the volumes
  // are 0..1 gains applied to those channels independently of the song volume.
  metronome: boolean;
  metronomeVolume: number;
  hitSounds: boolean;
  hitSoundVolume: number;
  showWaveform: boolean;
  // Per-panel collapsed state keyed by panel id (e.g., 'tools', 'options', 'history', 'selection', 'events').
  panelCollapsed: Record<string, boolean>;
}

// The baseline px/s value the user-facing "zoom" percentage treats as 100%. Decoupled from the
// initial pixelsPerSecond so we can re-baseline later without surprising users mid-session.
export const ZOOM_BASELINE_PPS = 220;

const initial: EditorState = {
  tool: 'select',
  snapEnabled: true,
  snapDivision: '1/8',
  pixelsPerSecond: ZOOM_BASELINE_PPS,
  selection: new Set(),
  playheadTick: 0,
  audioReady: false,
  preventDuplicates: true,
  lockNotes: false,
  mirrorPlacement: false,
  offsetInMs: false,
  playbackRate: 1,
  metronome: false,
  metronomeVolume: 0.7,
  hitSounds: false,
  hitSoundVolume: 0.7,
  showWaveform: false,
  panelCollapsed: {},
};

const OPTIONS_KEY = 'yunyun.options';
const PANELS_KEY = 'yunyun.panels.collapsed';

interface PersistedOptions {
  preventDuplicates?: boolean;
  lockNotes?: boolean;
  mirrorPlacement?: boolean;
  offsetInMs?: boolean;
  playbackRate?: number;
  metronome?: boolean;
  metronomeVolume?: number;
  hitSounds?: boolean;
  hitSoundVolume?: number;
  showWaveform?: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function loadPersisted(): Partial<EditorState> {
  if (typeof localStorage === 'undefined') return {};
  const out: Partial<EditorState> = {};
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedOptions;
      if (typeof parsed.preventDuplicates === 'boolean') out.preventDuplicates = parsed.preventDuplicates;
      if (typeof parsed.lockNotes === 'boolean') out.lockNotes = parsed.lockNotes;
      if (typeof parsed.mirrorPlacement === 'boolean') out.mirrorPlacement = parsed.mirrorPlacement;
      if (typeof parsed.offsetInMs === 'boolean') out.offsetInMs = parsed.offsetInMs;
      if (typeof parsed.playbackRate === 'number' && Number.isFinite(parsed.playbackRate)) {
        out.playbackRate = Math.max(0.25, Math.min(2.0, parsed.playbackRate));
      }
      if (typeof parsed.metronome === 'boolean') out.metronome = parsed.metronome;
      if (typeof parsed.metronomeVolume === 'number' && Number.isFinite(parsed.metronomeVolume)) {
        out.metronomeVolume = clamp01(parsed.metronomeVolume);
      }
      if (typeof parsed.hitSounds === 'boolean') out.hitSounds = parsed.hitSounds;
      if (typeof parsed.hitSoundVolume === 'number' && Number.isFinite(parsed.hitSoundVolume)) {
        out.hitSoundVolume = clamp01(parsed.hitSoundVolume);
      }
      if (typeof parsed.showWaveform === 'boolean') out.showWaveform = parsed.showWaveform;
    }
  } catch {
    // ignore — corrupt/missing keys fall back to defaults
  }
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === 'object') out.panelCollapsed = parsed;
    }
  } catch {
    // ignore
  }
  return out;
}

export const editor = writable<EditorState>({ ...initial, ...loadPersisted() });

function persistOptions(s: EditorState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PersistedOptions = {
      preventDuplicates: s.preventDuplicates,
      lockNotes: s.lockNotes,
      mirrorPlacement: s.mirrorPlacement,
      offsetInMs: s.offsetInMs,
      playbackRate: s.playbackRate,
      metronome: s.metronome,
      metronomeVolume: s.metronomeVolume,
      hitSounds: s.hitSounds,
      hitSoundVolume: s.hitSoundVolume,
      showWaveform: s.showWaveform,
    };
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may throw in private mode or when full — preferences just won't persist this session.
  }
}

function persistPanels(s: EditorState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(s.panelCollapsed));
  } catch {
    // ignore
  }
}

export function setTool(tool: EditorState['tool']): void {
  editor.update((s) => ({ ...s, tool }));
}

export function setSnap(enabled: boolean): void {
  editor.update((s) => ({ ...s, snapEnabled: enabled }));
}

export function setSnapDivision(d: SnapDivision): void {
  editor.update((s) => ({ ...s, snapDivision: d }));
}

export function setZoom(pps: number): void {
  editor.update((s) => ({ ...s, pixelsPerSecond: Math.max(40, Math.min(1200, pps)) }));
}

export function selectOnly(id: string): void {
  editor.update((s) => ({ ...s, selection: new Set([id]) }));
}

export function selectAdd(id: string): void {
  editor.update((s) => {
    const next = new Set(s.selection);
    next.add(id);
    return { ...s, selection: next };
  });
}

export function selectToggle(id: string): void {
  editor.update((s) => {
    const next = new Set(s.selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { ...s, selection: next };
  });
}

export function clearSelection(): void {
  editor.update((s) => ({ ...s, selection: new Set() }));
}

export function setPlayhead(tick: number): void {
  editor.update((s) => ({ ...s, playheadTick: tick }));
}

export function setAudioReady(v: boolean): void {
  editor.update((s) => ({ ...s, audioReady: v }));
}

export function setPreventDuplicates(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, preventDuplicates: v };
    persistOptions(next);
    return next;
  });
}

export function setLockNotes(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, lockNotes: v };
    persistOptions(next);
    return next;
  });
}

export function setMirrorPlacement(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, mirrorPlacement: v };
    persistOptions(next);
    return next;
  });
}

export function setOffsetInMs(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, offsetInMs: v };
    persistOptions(next);
    return next;
  });
}

export function setPlaybackRate(v: number): void {
  const clamped = Math.max(0.25, Math.min(2.0, v));
  editor.update((s) => {
    const next = { ...s, playbackRate: clamped };
    persistOptions(next);
    return next;
  });
}

export function setMetronome(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, metronome: v };
    persistOptions(next);
    return next;
  });
}

export function setMetronomeVolume(v: number): void {
  const clamped = clamp01(v);
  editor.update((s) => {
    const next = { ...s, metronomeVolume: clamped };
    persistOptions(next);
    return next;
  });
}

export function setHitSounds(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, hitSounds: v };
    persistOptions(next);
    return next;
  });
}

export function setHitSoundVolume(v: number): void {
  const clamped = clamp01(v);
  editor.update((s) => {
    const next = { ...s, hitSoundVolume: clamped };
    persistOptions(next);
    return next;
  });
}

export function setShowWaveform(v: boolean): void {
  editor.update((s) => {
    const next = { ...s, showWaveform: v };
    persistOptions(next);
    return next;
  });
}

export function setPanelCollapsed(panelId: string, collapsed: boolean): void {
  editor.update((s) => {
    const next = { ...s, panelCollapsed: { ...s.panelCollapsed, [panelId]: collapsed } };
    persistPanels(next);
    return next;
  });
}
