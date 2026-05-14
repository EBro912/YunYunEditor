// Single source of truth for displayed keybinds. The handler in App.svelte is authoritative for
// behavior — this list mirrors it for documentation purposes (tooltips, modal, README).
// Keep entries in sync when adding/removing shortcuts.

export interface Keybind {
  keys: string[]; // e.g., ['Ctrl', 'Z'] or just ['?']
  action: string;
}

export interface KeybindGroup {
  title: string;
  binds: Keybind[];
}

export const KEYBINDS: KeybindGroup[] = [
  {
    title: 'Tools',
    binds: [
      { keys: ['V'], action: 'Select tool' },
      { keys: ['1'], action: 'Single-note placement' },
      { keys: ['2'], action: 'Hold-note placement (drag)' },
      { keys: ['3'], action: 'Rush-note placement (drag)' },
      { keys: ['4'], action: 'Eraser' },
    ],
  },
  {
    title: 'Placement (at playhead)',
    binds: [
      { keys: ['S'], action: 'Place single note in lane 2' },
      { keys: ['D'], action: 'Place single note in lane 3' },
      { keys: ['K'], action: 'Place single note in lane 4' },
      { keys: ['L'], action: 'Place single note in lane 5' },
    ],
  },
  {
    title: 'Editing',
    binds: [
      { keys: ['Ctrl', 'Z'], action: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
      { keys: ['Ctrl', 'Y'], action: 'Redo (alternative)' },
      { keys: ['Ctrl', 'C'], action: 'Copy selection' },
      { keys: ['Ctrl', 'V'], action: 'Paste at playhead' },
      { keys: ['Delete'], action: 'Delete selection' },
      { keys: ['Backspace'], action: 'Delete selection' },
      { keys: [','], action: 'Nudge selection −1 snap unit' },
      { keys: ['.'], action: 'Nudge selection +1 snap unit' },
      { keys: ['<'], action: 'Nudge selection −1 beat (1/4)' },
      { keys: ['>'], action: 'Nudge selection +1 beat (1/4)' },
    ],
  },
  {
    title: 'Transport',
    binds: [
      { keys: ['Space'], action: 'Play / pause' },
      { keys: ['Home'], action: 'Seek to start' },
      { keys: ['End'], action: 'Seek to end' },
    ],
  },
  {
    title: 'Snap',
    binds: [
      { keys: ['['], action: 'Snap division — coarser' },
      { keys: [']'], action: 'Snap division — finer' },
    ],
  },
  {
    title: 'Files',
    binds: [
      { keys: ['Ctrl', 'O'], action: 'Open / Import .zip' },
      { keys: ['Ctrl', 'S'], action: 'Force autosave' },
      { keys: ['Ctrl', 'E'], action: 'Open Export dialog' },
      { keys: ['?'], action: 'Show this keybinds list' },
    ],
  },
];
