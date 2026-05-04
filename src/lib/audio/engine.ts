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
  private playStartCtxTime = 0;
  private playStartSongSeconds = 0;
  private playing = false;

  ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async load(bytes: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    this.stopInternal();
    this.buffer = await decodeOgg(ctx, bytes);
    this.playStartSongSeconds = 0;
  }

  unload(): void {
    this.stopInternal();
    this.buffer = null;
    this.playStartSongSeconds = 0;
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
    src.connect(this.ctx.destination);
    const startSec = clamp(this.playStartSongSeconds, 0, this.buffer.duration);
    this.playStartCtxTime = this.ctx.currentTime;
    this.playStartSongSeconds = startSec;
    src.onended = () => {
      // Auto-stop at end of buffer.
      if (src === this.source) {
        this.playing = false;
        this.playStartSongSeconds = this.duration();
        this.source = null;
      }
    };
    src.start(0, startSec);
    this.source = src;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.playStartSongSeconds = this.songSeconds();
    this.stopInternal();
  }

  seek(songSec: number): void {
    const wasPlaying = this.playing;
    this.stopInternal();
    this.playStartSongSeconds = clamp(songSec, 0, this.duration());
    if (wasPlaying) this.play();
  }

  songSeconds(): number {
    if (!this.ctx || !this.buffer) return this.playStartSongSeconds;
    if (!this.playing) return this.playStartSongSeconds;
    return this.playStartSongSeconds + (this.ctx.currentTime - this.playStartCtxTime);
  }

  isPlaying(): boolean {
    return this.playing;
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
