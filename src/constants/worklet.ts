/**
 * AudioWorklet processor source — inlined as a string so it can be loaded via
 * a Blob URL.  This avoids file-serving issues with Electron's file:// protocol
 * in production builds.
 *
 * Buffers ~3 seconds of 128-sample frames before flushing a single Float32Array
 * to the App component (which then resamples and sends to Whisper).
 *
 *   375 frames × 128 samples / 16 000 Hz ≈ 3 s
 */
export const WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = []
    this._count = 0
    this._flushAt = 375
  }
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch) {
      this._buf.push(Float32Array.from(ch))
      this._count++
      if (this._count >= this._flushAt) {
        const total = this._buf.reduce((n, f) => n + f.length, 0)
        const out = new Float32Array(total)
        let off = 0
        for (const f of this._buf) { out.set(f, off); off += f.length }
        this.port.postMessage(out, [out.buffer])
        this._buf = []
        this._count = 0
      }
    }
    return true
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor)
`
