import { WORKLET_CODE } from '../constants/worklet.ts'

// ─── Resampling ───────────────────────────────────────────────────────────────

/**
 * Linear-interpolation resample from any sample rate to 16 000 Hz.
 * Whisper models expect 16 kHz mono PCM.
 */
export function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return input

  const ratio  = fromRate / 16000
  const outLen = Math.ceil(input.length / ratio)
  const out    = new Float32Array(outLen)

  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const lo  = Math.floor(src)
    const hi  = Math.min(lo + 1, input.length - 1)
    const t   = src - lo
    out[i]    = (input[lo] ?? 0) * (1 - t) + (input[hi] ?? 0) * t
  }

  return out
}

// ─── Audio graph builder ──────────────────────────────────────────────────────

/**
 * Creates an AudioContext + AudioWorkletNode + AnalyserNode from a MediaStream.
 *
 * The worklet flushes PCM chunks (Float32Array) to `onChunk` every ~3 seconds.
 * The AnalyserNode is returned so the caller can drive the visualizer.
 *
 * Uses a Blob URL for the worklet so it loads correctly under both
 * `http://` (Vite dev server) and `file://` (packaged Electron).
 */
export async function buildAudioGraph(
  stream:  MediaStream,
  onChunk: (chunk: Float32Array, sampleRate: number) => void,
): Promise<{ ctx: AudioContext; analyser: AnalyserNode }> {
  // Register the worklet without touching the file system
  const blob    = new Blob([WORKLET_CODE], { type: 'application/javascript' })
  const blobUrl = URL.createObjectURL(blob)

  const ctx = new AudioContext()
  await ctx.audioWorklet.addModule(blobUrl)
  URL.revokeObjectURL(blobUrl)

  const source   = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize               = 256
  analyser.smoothingTimeConstant = 0.75

  const worklet = new AudioWorkletNode(ctx, 'audio-capture-processor')
  worklet.port.onmessage = (ev: MessageEvent<Float32Array>) => {
    onChunk(ev.data, ctx.sampleRate)
  }

  // source ─► analyser (visualizer) AND worklet (transcription pipeline)
  source.connect(analyser)
  source.connect(worklet)
  // Keep the analyser's output connected so the node doesn't get garbage-collected
  analyser.connect(ctx.destination)

  return { ctx, analyser }
}

// ─── Stream helpers ───────────────────────────────────────────────────────────

/** Stop every track in a MediaStream and release the device. */
export function releaseStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(t => t.stop())
}

/** Drop the video tracks from a getDisplayMedia stream (we only need audio). */
export function dropVideoTracks(stream: MediaStream): void {
  stream.getVideoTracks().forEach(t => t.stop())
}
