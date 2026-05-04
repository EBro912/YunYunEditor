// .ogg-only validation + Web Audio decode wrapper.

export class AudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioDecodeError';
  }
}

export function isOggFilename(name: string): boolean {
  return /\.ogg$/i.test(name);
}

// Ogg files start with the "OggS" capture pattern. Sniffing this catches mis-named files
// (e.g. an MP3 renamed to .ogg, or audio referenced inside a ZIP whose extension we trust blindly)
// before they reach decodeAudioData, where they'd surface as an opaque DOMException.
export function hasOggMagic(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  const view = new Uint8Array(bytes, 0, 4);
  return view[0] === 0x4f && view[1] === 0x67 && view[2] === 0x67 && view[3] === 0x53;
}

export async function decodeOgg(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  if (!hasOggMagic(bytes)) {
    throw new AudioDecodeError('Audio is not an Ogg file (missing OggS header). Only .ogg Vorbis is supported.');
  }
  // decodeAudioData detaches the buffer; clone first so the caller can keep the original for re-export.
  const copy = bytes.slice(0);
  return await ctx.decodeAudioData(copy);
}
