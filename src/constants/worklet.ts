/**
 * AudioWorklet processor source — inlined as a string so it can be loaded via
 * a Blob URL.  This avoids file-serving issues with Electron's file:// protocol
 * in production builds.
 *
 * DURACIÓN DEL CHUNK
 * ------------------
 * Whisper necesita al menos 5 segundos de audio para transcribir con precisión.
 * Se usa el global `sampleRate` (disponible en AudioWorkletGlobalScope) en lugar
 * de un número fijo de frames, para que el cálculo sea correcto
 * independientemente de la tasa del dispositivo (44100, 48000, etc.).
 *
 *   sampleRate × 5 s = muestras necesarias para un chunk de 5 segundos
 *
 * DETECCIÓN DE SILENCIO
 * ----------------------
 * Se calcula la RMS de cada frame. Si el chunk entero está por debajo del
 * umbral, no se envía al proceso principal para evitar transcripciones vacías
 * o texto alucinado por Whisper en señales casi nulas.
 */
export const WORKLET_CODE = `
const CHUNK_SECONDS   = 5       // duración objetivo del chunk
const SILENCE_THRESH  = 0.003   // RMS mínimo para considerar que hay voz

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf     = []
    this._samples = 0
    // Número de muestras necesarias para CHUNK_SECONDS segundos
    // sampleRate es un global de AudioWorkletGlobalScope
    this._target  = Math.round(sampleRate * CHUNK_SECONDS)
  }

  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true

    this._buf.push(Float32Array.from(ch))
    this._samples += ch.length

    if (this._samples >= this._target) {
      // Concatenar frames en un único buffer
      const out = new Float32Array(this._samples)
      let off = 0
      for (const f of this._buf) { out.set(f, off); off += f.length }

      // Calcular RMS del chunk completo
      let sum = 0
      for (let i = 0; i < out.length; i++) sum += out[i] * out[i]
      const rms = Math.sqrt(sum / out.length)

      // Sólo enviar si hay actividad de voz significativa
      if (rms >= SILENCE_THRESH) {
        this.port.postMessage(out, [out.buffer])
      }

      this._buf     = []
      this._samples = 0
    }

    return true
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor)
`
