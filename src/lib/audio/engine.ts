// Single-source-of-truth audio transport. AudioContext.currentTime is the master clock.
// Song-seconds at any frame: playStartSongSeconds + (ctx.currentTime - playStartCtxTime).

import { decodeOgg } from './decode';

export interface TransportSnapshot {
  songSeconds: number;
  playing: boolean;
  durationSeconds: number;
  loaded: boolean;
}

class Transport {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private volume = 1;
  private playStartCtxTime = 0;
  private playStartSongSeconds = 0;
  private playing = false;
  // Playback rate (1.0 = normal). Applied to AudioBufferSourceNode.playbackRate. Pitches the
  // audio at non-1.0 rates (no time-stretching), matching osu!-style chart editor convention.
  private rate = 1;
  // Monotonic load token. Each load() call claims a fresh value; if a slower decode resolves
  // after a newer load has been issued, we ignore the stale buffer instead of installing it.
  private loadToken = 0;
  // Monotonic playback epoch. Bumped whenever the song↔context time mapping discontinuously
  // changes (play/pause/seek/rate-rebase/load/unload). External schedulers (metronome, hit
  // sounds) watch this to know they must flush already-scheduled events and re-sync.
  private epoch = 0;

  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  setVolume(v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.volume = clamped;
    if (this.gain) this.gain.gain.value = clamped;
  }

  getVolume(): number {
    return this.volume;
  }

  // Rebase the song-time epoch with the OLD rate before swapping, so a mid-playback rate change
  // doesn't retroactively reinterpret elapsed time at the new rate. The source's playbackRate is
  // an AudioParam and updates seamlessly on a live node.
  setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.25, Math.min(2.0, rate));
    if (clamped === this.rate) return;
    if (this.playing && this.ctx) {
      const now = this.ctx.currentTime;
      this.playStartSongSeconds = this.playStartSongSeconds + (now - this.playStartCtxTime) * this.rate;
      this.playStartCtxTime = now;
    }
    this.rate = clamped;
    if (this.source) this.source.playbackRate.value = clamped;
    this.epoch++;
  }

  getPlaybackRate(): number {
    return this.rate;
  }

  async load(bytes: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    this.stopInternal();
    // Bump now, not after decode: stopInternal() has already killed the old playback, so the
    // song↔context mapping is dead. Deferring to the post-decode bump would let a scheduler
    // keep queued FX (e.g. a looped sustain) alive against the old song during a slow/failed
    // decode. The post-decode bump still fires for the freshly-loaded buffer.
    this.epoch++;
    const token = ++this.loadToken;
    let decoded: AudioBuffer;
    try {
      decoded = await decodeOgg(ctx, bytes);
    } catch (err) {
      // Swallow stale rejections: if a newer load/unload bumped the token mid-decode, this
      // failure is for a superseded request and the App-level catch must not unload the
      // current buffer. Only propagate when we're still the active load.
      if (token !== this.loadToken) return;
      throw err;
    }
    if (token !== this.loadToken) {
      // A newer load (or unload) superseded this one mid-decode. Drop the stale buffer.
      return;
    }
    this.buffer = decoded;
    this.playStartSongSeconds = 0;
    this.epoch++;
  }

  unload(): void {
    this.stopInternal();
    // Bump the token so any in-flight decode from a load() call resolves into the discard branch.
    this.loadToken++;
    this.buffer = null;
    this.playStartSongSeconds = 0;
    this.epoch++;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getAudioBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  // Monotonic; changes whenever the song↔context time mapping jumps. Schedulers diff this
  // against their last-seen value to decide when to flush pending scheduled audio.
  getEpoch(): number {
    return this.epoch;
  }

  // Inverse of songSeconds(): map a (future) song-time onto the AudioContext clock so callers
  // can schedule sample-accurate events. Only meaningful while playing — returns null otherwise.
  songTimeToContextTime(songSec: number): number | null {
    if (!this.ctx || !this.playing) return null;
    return this.playStartCtxTime + (songSec - this.playStartSongSeconds) / this.rate;
  }

  isLoaded(): boolean {
    return this.buffer !== null;
  }

  duration(): number {
    return this.buffer?.duration ?? 0;
  }

  play(): void {
    if (!this.ctx || !this.buffer || this.playing) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    src.connect(this.gain ?? this.ctx.destination);
    const startSec = clamp(this.playStartSongSeconds, 0, this.buffer.duration);
    this.playStartCtxTime = this.ctx.currentTime;
    this.playStartSongSeconds = startSec;
    src.onended = () => {
      // Auto-stop at end of buffer.
      if (src === this.source) {
        this.playing = false;
        this.playStartSongSeconds = this.duration();
        this.source = null;
        this.epoch++;
      }
    };
    src.start(0, startSec);
    this.source = src;
    this.playing = true;
    this.epoch++;
  }

  pause(): void {
    if (!this.playing) return;
    this.playStartSongSeconds = this.songSeconds();
    this.stopInternal();
    this.epoch++;
  }

  seek(songSec: number): void {
    const wasPlaying = this.playing;
    this.stopInternal();
    this.playStartSongSeconds = clamp(songSec, 0, this.duration());
    // play() bumps the epoch itself; bump here too for the paused-seek case so a scrub while
    // stopped still invalidates anything a scheduler may have queued.
    if (wasPlaying) this.play();
    else this.epoch++;
  }

  songSeconds(): number {
    if (!this.ctx || !this.buffer) return this.playStartSongSeconds;
    if (!this.playing) return this.playStartSongSeconds;
    return this.playStartSongSeconds + (this.ctx.currentTime - this.playStartCtxTime) * this.rate;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // Song-time the current epoch's mapping is anchored at (the play/seek/pause position).
  // songSeconds() has already advanced past this by the time a rAF-driven scheduler observes
  // the epoch bump; schedulers use this so the first post-discontinuity window starts at the
  // user's chosen position instead of dropping an event that sits exactly on it.
  getAnchorSongSeconds(): number {
    return this.playStartSongSeconds;
  }

  snapshot(): TransportSnapshot {
    return {
      songSeconds: this.songSeconds(),
      playing: this.playing,
      durationSeconds: this.duration(),
      loaded: this.isLoaded(),
    };
  }

  private stopInternal(): void {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        // already stopped
      }
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
    this.playing = false;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

export const transport = new Transport();
