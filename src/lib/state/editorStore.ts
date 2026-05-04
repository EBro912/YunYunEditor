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
}

const initial: EditorState = {
  tool: 'select',
  snapEnabled: true,
  snapDivision: '1/8',
  pixelsPerSecond: 220,
  selection: new Set(),
  playheadTick: 0,
  audioReady: false,
};

export const editor = writable<EditorState>(initial);

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
