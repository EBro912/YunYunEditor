// One-time peak precompute for the optional scrolling waveform overlay. The chart scrolls in
// song-time, so peaks are binned by *time* (not sample index) at a fixed resolution: the
// renderer maps each pixel row → song-time → bin in O(1) with no per-frame DSP.

export interface WaveformData {
  binsPerSecond: number;
  // Interleaved [min, max] amplitude per time bin, mixed down to mono. Range roughly [-1, 1].
  peaks: Float32Array;
  binCount: number;
}

// 400 bins/s ≈ 2.5ms per bin — finer than a pixel even at max zoom (~545 px/s), while keeping a
// 5-minute track to ~120k bins (~960 KB). Tunable if profiling shows it matters.
const DEFAULT_BINS_PER_SECOND = 400;

export function buildWaveformPeaks(
  buffer: AudioBuffer,
  binsPerSecond = DEFAULT_BINS_PER_SECOND,
): WaveformData {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const binCount = Math.max(1, Math.ceil(buffer.duration * binsPerSecond));
  const samplesPerBin = sampleRate / binsPerSecond;
  const peaks = new Float32Array(binCount * 2);

  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  for (let bin = 0; bin < binCount; bin++) {
    const start = Math.floor(bin * samplesPerBin);
    const end = Math.min(data[0].length, Math.floor((bin + 1) * samplesPerBin));
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i++) {
      // Mono mix so a hard-panned track still shows a peak on the relevant side.
      let s = 0;
      for (let c = 0; c < channels; c++) s += data[c][i];
      s /= channels;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    peaks[bin * 2] = min;
    peaks[bin * 2 + 1] = max;
  }

  return { binsPerSecond, peaks, binCount };
}
