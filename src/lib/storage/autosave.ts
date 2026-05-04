import type { DraftChart } from './drafts';
import { writeCurrent } from './drafts';

const AUTOSAVE_DELAY_MS = 2000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: DraftChart | null = null;

export function scheduleAutosave(chart: DraftChart): void {
  pending = chart;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushNow, AUTOSAVE_DELAY_MS);
}

export function flushNow(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    try {
      writeCurrent(pending);
    } catch (err) {
      console.error('autosave failed', err);
      throw err;
    }
    pending = null;
  }
}

export function setupBeforeUnloadFlush(): void {
  window.addEventListener('beforeunload', () => {
    if (pending) {
      try {
        writeCurrent(pending);
      } catch {
        // best effort; ignore here so we don't block unload
      }
    }
  });
}
