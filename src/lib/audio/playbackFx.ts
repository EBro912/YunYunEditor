// Lookahead scheduler for playback FX: the metronome and note hit sounds. Both share the exact
// same machinery (a small song-time window scheduled slightly ahead onto the AudioContext clock,
// flushed whenever the transport's song↔context mapping jumps), so they live together rather
// than in two modules that would duplicate all of it.
//
// `pump()` is called once per animation frame from App.svelte's existing rAF loop. The standard
// Web Audio metronome uses a 25ms setInterval; rAF (~16ms) is finer and keeps FX consistent with
// the rest of the editor, which already pauses its visual playhead when the tab is hidden.

import { transport } from './engine';
import { tickToSeconds, secondsToTick, TPQN, type TempoSegment } from '../timing/ticks';
import { barTicks } from '../timing/snap';
import type { LevelJson, TimeSignatureEvent } from '../model/level';
import { ensureHitSounds, getHitBuffers } from './hitsoundAssets';

export interface PumpConfig {
  level: LevelJson;
  tempoMap: TempoSegment[];
  songSeconds: number;
  metronome: boolean;
  metronomeVolume: number;
  hitSounds: boolean;
  hitSoundVolume: number;
}

// How far ahead of the playhead we schedule. Long enough to survive a dropped frame, short
// enough that a mid-playback rate/seek change only mis-times a few ms of already-queued audio.
const LOOKAHEAD = 0.12;
// Hard cap on beats/notes enumerated per pump so a degenerate tempo map can't hang the frame.
const MAX_EVENTS = 512;

class PlaybackFx {
  private lastEpoch = -1;
  // Last-seen enabled state per channel, so a true→false toggle can flush the audio it queued.
  private lastMetronome = false;
  private lastHitSounds = false;
  // Song-time already scheduled up to (exclusive upper bound of the last window).
  private cursorSong = 0;
  // The next scheduling window is the first after a transport discontinuity (play/seek). Its
  // lower bound is inclusive and anchored at the user's chosen position so a beat / hit sound
  // sitting exactly on the play-or-seek point isn't dropped.
  private freshEpoch = false;
  // Scheduled-but-not-finished nodes, tracked so a flush can silence queued audio immediately.
  private pending = new Set<AudioScheduledSourceNode>();

  pump(cfg: PumpConfig): void {
    const ctx = transport.getContext();
    if (!ctx) return;

    const epoch = transport.getEpoch();
    if (epoch !== this.lastEpoch) {
      // Transport discontinuity (play/pause/seek/rate/load). Kill anything queued against the
      // old mapping and re-anchor the cursor at the current position.
      this.flush();
      this.lastEpoch = epoch;
      // Anchor at the play/seek position, not the already-advanced playhead, so the first
      // window covers an event sitting exactly on that position.
      this.cursorSong = transport.getAnchorSongSeconds();
      this.freshEpoch = true;
    }

    // A channel switched off must silence what it already queued — most audible for a looped
    // hold/rush sustain, which otherwise drones until the note ends. The pending set is shared
    // across channels, so flush all and re-anchor; any still-enabled channel reschedules from
    // the current song time on the next pumps (same recovery as an epoch reset).
    if ((this.lastMetronome && !cfg.metronome) || (this.lastHitSounds && !cfg.hitSounds)) {
      this.flush();
      this.cursorSong = cfg.songSeconds;
      this.freshEpoch = false;
    }
    this.lastMetronome = cfg.metronome;
    this.lastHitSounds = cfg.hitSounds;

    if (!transport.isPlaying()) return;
    if (cfg.hitSounds && !getHitBuffers()) void ensureHitSounds(ctx);

    // First window after a discontinuity starts at the anchor (cursorSong), but never more
    // than one lookahead behind the playhead: a long stall before the first frame catches up
    // at most LOOKAHEAD of beats rather than machine-gunning every missed one (same stall
    // philosophy as the steady-state clamp below).
    const windowStart = this.freshEpoch
      ? Math.max(this.cursorSong, cfg.songSeconds - LOOKAHEAD)
      : Math.max(this.cursorSong, cfg.songSeconds);
    const windowEnd = cfg.songSeconds + LOOKAHEAD;
    if (windowEnd <= windowStart) {
      this.cursorSong = windowEnd;
      this.freshEpoch = false;
      return;
    }

    const inclusiveLo = this.freshEpoch;
    if (cfg.metronome) this.scheduleBeats(ctx, cfg, windowStart, windowEnd, inclusiveLo);
    if (cfg.hitSounds) this.scheduleHits(ctx, cfg, windowStart, windowEnd, inclusiveLo);

    this.cursorSong = windowEnd;
    this.freshEpoch = false;
  }

  // Stop everything queued. Called on transport discontinuities and when FX are switched off.
  flush(): void {
    for (const node of this.pending) {
      try {
        node.onended = null;
        node.stop();
      } catch {
        // already stopped / never started
      }
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    }
    this.pending.clear();
  }

  private track(node: AudioScheduledSourceNode): void {
    this.pending.add(node);
    node.onended = () => {
      this.pending.delete(node);
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    };
  }

  // Clamp scheduled times that have already slipped into the past (a long frame) up to "now" so
  // the event still fires instead of throwing / being silently dropped.
  private at(ctx: AudioContext, songSec: number): number | null {
    const t = transport.songTimeToContextTime(songSec);
    if (t == null) return null;
    return Math.max(t, ctx.currentTime);
  }

  private scheduleBeats(
    ctx: AudioContext,
    cfg: PumpConfig,
    loSong: number,
    hiSong: number,
    inclusiveLo: boolean,
  ): void {
    const { level, tempoMap } = cfg;
    const off = level.ScoreOffset;
    const tsList: TimeSignatureEvent[] = [level.InitTimeSignature, ...level.TimeSignature];
    const segFor = (tick: number): TimeSignatureEvent => {
      let seg = tsList[0];
      for (const ts of tsList) {
        if (ts.Tick <= tick) seg = ts;
        else break;
      }
      return seg;
    };

    const tLo = secondsToTick(loSong, tempoMap, off);
    let seg = segFor(tLo);
    // First beat boundary (anchored at the TS-change tick, matching the rendered grid) at/after tLo.
    let tick = seg.Tick + Math.ceil((tLo - seg.Tick) / TPQN) * TPQN;
    // A TS change between tLo and that beat re-anchors the grid at the change tick, putting a
    // downbeat there ahead of the computed beat. Start from it instead of overshooting.
    const firstChange = tsList.find((ts) => ts.Tick > tLo);
    if (firstChange && firstChange.Tick < tick) {
      seg = firstChange;
      tick = firstChange.Tick;
    }

    for (let guard = 0; guard < MAX_EVENTS; guard++) {
      const songSec = tickToSeconds(tick, tempoMap, off);
      if (songSec > hiSong) break;
      if (inclusiveLo ? songSec >= loSong : songSec > loSong) {
        const bt = barTicks(seg);
        const accent = Number.isFinite(bt) && bt > 0 ? (tick - seg.Tick) % bt === 0 : false;
        const when = this.at(ctx, songSec);
        if (when != null) this.click(ctx, when, accent, cfg.metronomeVolume);
      }
      // Advance one beat, but snap onto a TS change's downbeat if one falls before it — the
      // grid re-anchors at the change tick, so that tick is the next beat, not a rounded-up one.
      const naive = tick + TPQN;
      const change = tsList.find((ts) => ts.Tick > tick);
      if (change && change.Tick < naive) {
        tick = change.Tick;
        seg = change;
      } else {
        tick = naive;
        seg = segFor(naive);
      }
    }
  }

  private scheduleHits(
    ctx: AudioContext,
    cfg: PumpConfig,
    loSong: number,
    hiSong: number,
    inclusiveLo: boolean,
  ): void {
    const bufs = getHitBuffers();
    if (!bufs) return;
    const { level, tempoMap } = cfg;
    const off = level.ScoreOffset;
    const vol = cfg.hitSoundVolume;

    const inWindow = (songSec: number) =>
      (inclusiveLo ? songSec >= loSong : songSec > loSong) && songSec <= hiSong;

    for (const n of level.SingleNotes) {
      const s = tickToSeconds(n.Tick, tempoMap, off);
      if (inWindow(s)) {
        const when = this.at(ctx, s);
        if (when != null) this.sample(ctx, bufs.hit, when, vol);
      }
    }
    const sustained = (arr: { Tick: number; Duration: number }[]) => {
      for (const n of arr) {
        const startSec = tickToSeconds(n.Tick, tempoMap, off);
        if (!inWindow(startSec)) continue;
        const when = this.at(ctx, startSec);
        if (when == null) continue;
        this.sample(ctx, bufs.hit, when, vol);
        // Loop the sustain sample for the hold's duration. The end maps independently through
        // the transport so a rate change before the tail still stops it at the right song-time.
        const endSec = tickToSeconds(n.Tick + n.Duration, tempoMap, off);
        const endWhen = this.at(ctx, endSec);
        if (endWhen != null && endWhen > when) this.sample(ctx, bufs.sustain, when, vol, endWhen);
      }
    };
    sustained(level.HoldNotes);
    sustained(level.RushNotes);
  }

  private click(ctx: AudioContext, when: number, accent: boolean, volume: number): void {
    if (volume <= 0) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = accent ? 1568 : 988; // G6 downbeat vs B5 off-beat
    const peak = Math.max(0.0001, volume * 0.6);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.06);
    this.track(osc);
  }

  private sample(
    ctx: AudioContext,
    buffer: AudioBuffer,
    when: number,
    volume: number,
    stopAt?: number,
  ): void {
    if (volume <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = volume;
    if (stopAt != null) src.loop = true;
    src.connect(g).connect(ctx.destination);
    src.start(when);
    if (stopAt != null) src.stop(stopAt);
    this.track(src);
  }
}

export const playbackFx = new PlaybackFx();
