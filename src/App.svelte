<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Toolbar from './components/Layout/Toolbar.svelte';
  import SidebarLeft from './components/Layout/SidebarLeft.svelte';
  import SidebarRight from './components/Layout/SidebarRight.svelte';
  import Transport from './components/Layout/Transport.svelte';
  import ChartCanvas from './components/Chart/ChartCanvas.svelte';
  import ChartScrollbar from './components/Chart/ChartScrollbar.svelte';
  import ImportDrop from './components/Modals/ImportDrop.svelte';
  import ExportDialog from './components/Modals/ExportDialog.svelte';
  import AboutDialog from './components/Modals/AboutDialog.svelte';
  import KeybindsDialog from './components/Modals/KeybindsDialog.svelte';

  import { chart, activeLevel, dirtyTick, loadFromImport, setChart, mutateActiveLevel } from './lib/state/chartStore';
  import { editor, setPlayhead, setTool, setSnapDivision, clearSelection } from './lib/state/editorStore';
  import { get } from 'svelte/store';
  import { undo, redo, pushHistory, clearHistory } from './lib/state/history';
  import { copySelection, pasteAtPlayhead } from './lib/state/clipboard';
  import { readCurrent, CURRENT_ID, reassignNoteIds } from './lib/storage/drafts';
  import { getAudio, deleteAudio } from './lib/storage/audioStore';
  import { scheduleAutosave, flushNow, setupBeforeUnloadFlush } from './lib/storage/autosave';
  import { emptySong } from './lib/model/song';
  import type { ImportedMod } from './lib/io/import';
  import { transport } from './lib/audio/engine';
  import { playbackFx } from './lib/audio/playbackFx';
  import { buildTempoMap, secondsToTick, tickToSeconds } from './lib/timing/ticks';
  import { SNAP_DIVISIONS, snapTick, type SnapDivision } from './lib/timing/snap';
  import { mirrorLane, newId, type HoldNote, type RushNote, type SingleNote } from './lib/model/notes';
  import type { LevelJson } from './lib/model/level';

  let exportOpen = $state(false);
  let aboutOpen = $state(false);
  let keybindsOpen = $state(false);
  let importer: ImportDrop | null = $state(null);
  let centerEl: HTMLElement | null = $state(null);
  let centerHeight = $state(0);

  let currentSec = $state(0);
  let durationSec = $state(0);
  let playing = $state(false);
  let raf = 0;

  async function loadAudioFromBytes(bytes: ArrayBuffer): Promise<void> {
    if (bytes.byteLength === 0) {
      transport.unload();
      durationSec = 0;
      return;
    }
    try {
      await transport.load(bytes);
      durationSec = transport.duration();
    } catch (err: any) {
      console.error('audio decode failed', err);
      alert(`Audio decode failed: ${err?.message ?? err}\n\nNote: Safari does not decode .ogg Vorbis natively. Use Chrome or Firefox.`);
      transport.unload();
      durationSec = 0;
    }
  }

  // Convert songSeconds → playheadTick on each frame while playing.
  function tick() {
    const snap = transport.snapshot();
    currentSec = snap.songSeconds;
    playing = snap.playing;
    durationSec = snap.durationSeconds;
    const lvl = $activeLevel;
    if (lvl) {
      const map = buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents);
      if (snap.playing) {
        const t = secondsToTick(snap.songSeconds, map, lvl.ScoreOffset);
        setPlayhead(Math.max(0, t));
      }
      // Drive the metronome / hit-sound scheduler. pump() no-ops while paused but still flushes
      // anything it had queued (the transport epoch bumps on pause/seek), so call it every frame.
      const ed = $editor;
      playbackFx.pump({
        level: lvl,
        tempoMap: map,
        songSeconds: snap.songSeconds,
        metronome: ed.metronome,
        metronomeVolume: ed.metronomeVolume,
        hitSounds: ed.hitSounds,
        hitSoundVolume: ed.hitSoundVolume,
      });
    } else {
      // No active level → pump() won't run, so it can't observe an epoch bump from an
      // unload/new-project. Flush directly so a queued looped sustain can't outlive the chart.
      playbackFx.flush();
    }
    raf = requestAnimationFrame(tick);
  }

  onMount(async () => {
    setupBeforeUnloadFlush();
    // Persisted playback rate lives on editorStore (restored from localStorage at module load).
    // Push it into the transport so the first play() picks it up.
    transport.setPlaybackRate(get(editor).playbackRate);
    raf = requestAnimationFrame(tick);
    if (centerEl) {
      centerHeight = centerEl.getBoundingClientRect().height;
      const ro = new ResizeObserver(() => {
        if (centerEl) centerHeight = centerEl.getBoundingClientRect().height;
      });
      ro.observe(centerEl);
      // ResizeObserver lifecycle is tied to the App component; it is cleaned up implicitly when
      // the document is torn down. No explicit disconnect needed for a top-level singleton.
    }
    // Try to restore the current draft. Audio comes from IndexedDB.
    const cur = readCurrent();
    if (cur) {
      reassignNoteIds(cur);
      const audio = await getAudio(CURRENT_ID).catch(() => undefined);
      const mod: ImportedMod = {
        song: cur.song,
        levels: new Map(Object.entries(cur.levels)),
        audio: audio ?? { filename: cur.song.Audio || 'audio.ogg', mime: 'audio/ogg', bytes: new ArrayBuffer(0) },
        modFolderName: cur.song.ID || 'mod',
        warnings: [],
      };
      // Mark the autoloaded cache as dirty: it's unsaved work that lives only in localStorage.
      // A subsequent draft load would clobber it, so the Drafts panel needs to prompt.
      loadFromImport(mod, { dirty: true });
      if (audio) await loadAudioFromBytes(audio.bytes);
      clearHistory();
      return;
    }
    // First run — start with an empty song. The user can import a .zip to populate.
    clearHistory();
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    // rAF is already cancelled, so tick()/pump() won't run again to flush — do it explicitly
    // before tearing down the transport.
    playbackFx.flush();
    transport.unload();
  });

  // Whenever the chart's audio bytes change (a new import), rehydrate the transport.
  // The Import path calls loadAudioFromBytes directly, but a draft load via the Drafts panel
  // doesn't go through onMount — watch the IndexedDB key indirectly via dirtyTick + audio fetch.
  // Dedupe by filename + byteLength AND transport.isLoaded(): newProject and decode failures call
  // transport.unload() externally, and without the isLoaded check the stale key would block a
  // legitimate re-import of the same file (player gets stuck at 0:00 / 0:00).
  let lastAudioKey = $state('');
  $effect(() => {
    void $dirtyTick;
    void $chart.song.Audio;
    void (async () => {
      const audio = await getAudio(CURRENT_ID).catch(() => undefined);
      if (!audio || audio.bytes.byteLength === 0) {
        if (transport.isLoaded()) {
          transport.unload();
          durationSec = 0;
        }
        lastAudioKey = '';
        return;
      }
      const key = `${audio.filename}::${audio.bytes.byteLength}`;
      if (key === lastAudioKey && transport.isLoaded()) return;
      lastAudioKey = key;
      await loadAudioFromBytes(audio.bytes);
    })();
  });

  // Autosave on every dirty tick.
  $effect(() => {
    void $dirtyTick;
    const c = $chart;
    if (!c.song) return;
    scheduleAutosave({ song: c.song, levels: c.levels });
  });

  async function newProject() {
    flushNow();
    // Drop the IDB audio first — otherwise the audio rehydrate $effect (triggered by setChart's
    // dirtyTick bump) finds the leftover bytes and reloads them straight back into the transport.
    await deleteAudio(CURRENT_ID).catch(() => undefined);
    setChart({ song: emptySong(), levels: {}, activeLevelPath: null });
    // History snapshots are chart-only; an undo across a project swap would restore the previous
    // chart against the new (empty) audio. Drop history so undo can't desync them.
    clearHistory();
    transport.unload();
    playbackFx.flush();
    durationSec = 0;
  }

  function syncPlayheadToAudioFromTick(): void {
    const lvl = $activeLevel;
    if (!lvl) return;
    const map = buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents);
    const sec = tickToSeconds($editor.playheadTick, map, lvl.ScoreOffset);
    transport.seek(sec);
  }

  function play() {
    syncPlayheadToAudioFromTick();
    transport.play();
  }
  function pause() {
    transport.pause();
  }
  function seekStart() {
    setPlayhead(0);
    transport.seek(0);
  }
  function seekEnd() {
    const lvl = $activeLevel;
    if (!lvl) return;
    const map = buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents);
    transport.seek(transport.duration());
    setPlayhead(secondsToTick(transport.duration(), map, lvl.ScoreOffset));
  }
  function seekToSec(sec: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const dur = transport.duration();
    const clamped = Math.max(0, Math.min(dur, sec));
    transport.seek(clamped);
    const map = buildTempoMap(lvl.InitBpm, lvl.BpmChangeEvents);
    setPlayhead(Math.max(0, secondsToTick(clamped, map, lvl.ScoreOffset)));
  }

  const SNAP_LIST: SnapDivision[] = ['1/3', '1/4', '1/6', '1/8', '1/16', '1/32'];

  function nudgeSelectionByBeatFraction(num: 1, den: number, sign: -1 | 1) {
    void num;
    const ids = new Set($editor.selection);
    if (ids.size === 0) return;
    const dTick = sign * Math.round(480 / den);
    pushHistory();
    mutateActiveLevel((lvl) => {
      const map = <T extends { id?: string; Tick: number }>(arr: T[]): T[] =>
        arr.map((n) => (n.id && ids.has(n.id) ? { ...n, Tick: Math.max(0, n.Tick + dTick) } : n));
      return {
        ...lvl,
        SingleNotes: map(lvl.SingleNotes) as SingleNote[],
        HoldNotes: map(lvl.HoldNotes) as HoldNote[],
        RushNotes: map(lvl.RushNotes) as RushNote[],
      };
    });
  }

  function deleteSelection() {
    const ids = new Set($editor.selection);
    if (ids.size === 0) return;
    pushHistory();
    mutateActiveLevel((lvl) => ({
      ...lvl,
      SingleNotes: lvl.SingleNotes.filter((n) => !n.id || !ids.has(n.id)),
      HoldNotes: lvl.HoldNotes.filter((n) => !n.id || !ids.has(n.id)),
      RushNotes: lvl.RushNotes.filter((n) => !n.id || !ids.has(n.id)),
    }));
    clearSelection();
  }

  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (e.key === 'Escape' && inField) {
      (target as HTMLElement).blur();
      return;
    }

    if (inField) {
      // Let inputs handle their own keys (incl. native undo). Only intercept truly global shortcuts below if needed.
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushNow();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      exportOpen = true;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      importer?.pickFile();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteAtPlayhead();
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (transport.isPlaying()) pause();
      else play();
      return;
    }
    if (e.key === 'Home') { e.preventDefault(); seekStart(); return; }
    if (e.key === 'End') { e.preventDefault(); seekEnd(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
      return;
    }
    if (e.key === '1') { setTool('single'); return; }
    if (e.key === '2') { setTool('hold'); return; }
    if (e.key === '3') { setTool('rush'); return; }
    if (e.key === '4') { setTool('eraser'); return; }
    if (e.key.toLowerCase() === 'v') { setTool('select'); return; }
    // SDKL → lanes 2..5 at the playhead. Matches in-game keybinds. S replaces the previous
    // snap-toggle hotkey since the snap checkbox in the transport bar covers that intent.
    if (e.key.toLowerCase() === 's') { e.preventDefault(); placeSingleAtPlayhead(2); return; }
    if (e.key.toLowerCase() === 'd') { e.preventDefault(); placeSingleAtPlayhead(3); return; }
    if (e.key.toLowerCase() === 'k') { e.preventDefault(); placeSingleAtPlayhead(4); return; }
    if (e.key.toLowerCase() === 'l') { e.preventDefault(); placeSingleAtPlayhead(5); return; }
    if (e.key === '[' || e.key === ']') {
      const dir = e.key === '[' ? -1 : 1;
      const arr = SNAP_LIST;
      const i = arr.indexOf($editor.snapDivision);
      const next = arr[Math.max(0, Math.min(arr.length - 1, i + dir))];
      setSnapDivision(next);
      return;
    }
    if (e.key === ',') { nudgeSelectionByBeatFraction(1, snapDenom($editor.snapDivision), -1); return; }
    if (e.key === '.') { nudgeSelectionByBeatFraction(1, snapDenom($editor.snapDivision), +1); return; }
    if (e.key === '<') { nudgeSelectionByBeatFraction(1, 4, -1); return; }
    if (e.key === '>') { nudgeSelectionByBeatFraction(1, 4, +1); return; }
    if (e.key === '?') { e.preventDefault(); keybindsOpen = true; return; }
  }

  function snapDenom(d: SnapDivision): number {
    return Math.round(480 / SNAP_DIVISIONS[d]);
  }

  function hasNoteAt(lvl: LevelJson, tick: number, lane: number): boolean {
    if (lvl.SingleNotes.some((n) => n.Tick === tick && n.Lane === lane)) return true;
    if (lvl.HoldNotes.some((n) => n.Tick === tick && n.Lane === lane)) return true;
    if (lvl.RushNotes.some((n) => n.Tick === tick && (n.Lane === lane || n.Lane + 1 === lane))) return true;
    return false;
  }

  // SDKL key handler: drop a single note at the current playhead tick in the given lane. Snaps
  // when snap is enabled, respects preventDuplicates, mirrors when mirrorPlacement is on. Matches
  // in-game keybinds so muscle memory carries over for chart authors.
  function placeSingleAtPlayhead(lane: number) {
    const lvl = $activeLevel;
    if (!lvl) return;
    const tick = $editor.snapEnabled
      ? Math.max(0, snapTick($editor.playheadTick, lvl.InitTimeSignature, lvl.TimeSignature, $editor.snapDivision))
      : Math.max(0, $editor.playheadTick);
    const mirror = $editor.mirrorPlacement ? mirrorLane(lane) : null;
    const blockDup = $editor.preventDuplicates;
    const primaryBlocked = blockDup && hasNoteAt(lvl, tick, lane);
    const mirrorBlocked = mirror != null && blockDup && hasNoteAt(lvl, tick, mirror);
    if (primaryBlocked && (mirror == null || mirrorBlocked)) return;
    pushHistory();
    mutateActiveLevel((l) => {
      const adds: SingleNote[] = [];
      if (!primaryBlocked) adds.push({ id: newId(), Tick: tick, Lane: lane, Type: 0 } as SingleNote);
      if (mirror != null && !mirrorBlocked && mirror !== lane) {
        adds.push({ id: newId(), Tick: tick, Lane: mirror, Type: 0 } as SingleNote);
      }
      return { ...l, SingleNotes: [...l.SingleNotes, ...adds] };
    });
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="app">
  <Toolbar
    onNew={newProject}
    onImport={() => importer?.pickFile()}
    onImportAudio={() => importer?.pickAudio()}
    onExport={() => (exportOpen = true)}
    onAbout={() => (aboutOpen = true)}
    onKeybinds={() => (keybindsOpen = true)}
  />

  <div class="body">
    <SidebarLeft />
    <main class="center" bind:this={centerEl}>
      <ChartCanvas />
      <ChartScrollbar
        currentSec={currentSec}
        durationSec={durationSec}
        pixelsPerSecond={$editor.pixelsPerSecond}
        canvasHeight={centerHeight}
        onSeek={seekToSec}
      />
    </main>
    <SidebarRight />
  </div>

  <Transport
    {currentSec}
    {durationSec}
    {playing}
    onPlay={play}
    onPause={pause}
    onSeekStart={seekStart}
    onSeekEnd={seekEnd}
  />
</div>

<ImportDrop bind:this={importer} />
<ExportDialog open={exportOpen} onClose={() => (exportOpen = false)} />
<AboutDialog open={aboutOpen} onClose={() => (aboutOpen = false)} />
<KeybindsDialog open={keybindsOpen} onClose={() => (keybindsOpen = false)} />

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-1);
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: row;
    min-width: 0;
    background: var(--bg-1);
  }
</style>
