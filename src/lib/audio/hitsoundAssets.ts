// Hit-sound samples extracted from the game. SE_06 is the regular note hit; SE_07 is the
// looped sustain used while a hold is held. (SE_10/SE_11 are the "super perfect" variants —
// not used here, kept in the repo for a possible future option.) These are .wav, so they go
// through the generic decodeAudioData path rather than the .ogg-only decode.ts.

import se06Url from '../../assets/hitsounds/SE_06.wav?url';
import se07Url from '../../assets/hitsounds/SE_07.wav?url';

interface HitBuffers {
  hit: AudioBuffer;
  sustain: AudioBuffer;
}

let buffers: HitBuffers | null = null;
let loading: Promise<HitBuffers | null> | null = null;

async function decodeUrl(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  const bytes = await res.arrayBuffer();
  return await ctx.decodeAudioData(bytes);
}

// Idempotent: the first call decodes both samples, later calls reuse the cached buffers (or the
// in-flight promise). Returns null if decoding fails so callers can degrade gracefully — a
// missing hit sound must never break playback.
export function ensureHitSounds(ctx: AudioContext): Promise<HitBuffers | null> {
  if (buffers) return Promise.resolve(buffers);
  if (loading) return loading;
  loading = Promise.all([decodeUrl(ctx, se06Url), decodeUrl(ctx, se07Url)])
    .then(([hit, sustain]) => {
      buffers = { hit, sustain };
      return buffers;
    })
    .catch((err) => {
      console.error('hit sound decode failed', err);
      loading = null; // allow a retry on the next toggle
      return null;
    });
  return loading;
}

export function getHitBuffers(): HitBuffers | null {
  return buffers;
}
