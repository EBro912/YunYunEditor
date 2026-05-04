import { get } from 'svelte/store';
import { chart, type ChartState } from './chartStore';

const HISTORY_LIMIT = 50;

interface Snapshot {
  state: ChartState;
}

const past: Snapshot[] = [];
const future: Snapshot[] = [];

function snapshot(): Snapshot {
  // Deep-clone via JSON — chart state is plain data (numbers, strings, arrays of plain objects).
  return { state: JSON.parse(JSON.stringify(get(chart))) as ChartState };
}

export function pushHistory(): void {
  past.push(snapshot());
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
}

export function undo(): boolean {
  if (past.length === 0) return false;
  const cur = snapshot();
  const prev = past.pop()!;
  future.push(cur);
  chart.set(prev.state);
  return true;
}

export function redo(): boolean {
  if (future.length === 0) return false;
  const cur = snapshot();
  const next = future.pop()!;
  past.push(cur);
  chart.set(next.state);
  return true;
}

export function clearHistory(): void {
  past.length = 0;
  future.length = 0;
}
