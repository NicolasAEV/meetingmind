/**
 * AudioWorklet processor source — inlined como string para cargarse vía Blob URL.
 * Esto evita problemas de servicio con el protocolo file:// de Electron en producción.
 *
 * DURACIÓN DEL CHUNK
 * ------------------
 * Whisper necesita al menos 5 s de audio para transcribir con precisión.
 * Se usa el global `sampleRate` (AudioWorkletGlobalScope) para que el cálculo
 * sea correcto independientemente de la tasa del dispositivo (44100 / 48000 Hz).
 *
 * FILTRO VAD — DETECCIÓN DE VOZ VS. MÚSICA
 * -----------------------------------------
 * Se aplican tres criterios en cascada antes de enviar el chunk a Whisper:
 *
 * 1. RMS global ≥ SILENCE_THRESH
 *    Descarta silencio completo o ruido de fondo casi nulo.
 *
 * 2. Coeficiente de variación (CV = σ/μ) de energías por frame ≥ MIN_CV
 *    La voz tiene pausas naturales → energía intermitente → CV alto (≥ 0.22).
 *    La música continua tiene energía sostenida → CV bajo (< 0.10–0.15).
 *
 * 3. Peso espectral en rango de voz humana [MIN_SPEC, MAX_SPEC]
 *    Calculado sin FFT como sw = √(Σ(x[i]-x[i-1])² / Σx[i]²).
 *    Esto aproxima 2π·fc/fs donde fc es la frecuencia centroide.
 *    A 48 kHz:
 *      sw = 0.013 → fc ≈  100 Hz  (bajo de música pura)
 *      sw = 0.065 → fc ≈  500 Hz  (límite inferior de voz)
 *      sw = 0.131 → fc ≈ 1000 Hz  (voz típica)
 *      sw = 0.327 → fc ≈ 2500 Hz  (consonantes/sibilantes)
 *      sw = 0.524 → fc ≈ 4000 Hz  (platillos, ruido agudo)
 *    Rango de voz: ≈ 0.04 – 0.44.
 *
 * 4. ZCR por muestra en rango de voz [MIN_ZCR, MAX_ZCR]
 *    La tasa de cruces por cero confirma que la frecuencia dominante
 *    cae en el rango de habla (100–3500 Hz aprox. a 48 kHz).
 */
export const WORKLET_CODE = `
const CHUNK_SECONDS  = 3       // duración objetivo del chunk

// ── Umbrales VAD ──────────────────────────────────────────────────────────────
const SILENCE_THRESH = 0.003   // RMS mínimo global
const MIN_CV         = 0.22    // varianza de energía: voz es intermitente
const MIN_SPEC       = 0.04    // filtro de bajo puro (< ~300 Hz dominante)
const MAX_SPEC       = 0.46    // filtro de ruido agudo (> ~3500 Hz dominante)
const MIN_ZCR        = 0.008   // ZCR mínimo por muestra (voz ≥ ~60 Hz)
const MAX_ZCR        = 0.22    // ZCR máximo por muestra (voz ≤ ~3300 Hz)

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf      = []
    this._samples  = 0
    this._target   = Math.round(sampleRate * CHUNK_SECONDS)
    this._frameRms = []   // RMS de cada frame de 128 muestras
  }

  process(inputs) {
    const ch = inputs[0]?.[0]
    if (!ch) return true

    // Acumular RMS de este frame para el cálculo de CV posterior
    let fSum = 0
    for (let i = 0; i < ch.length; i++) fSum += ch[i] * ch[i]
    this._frameRms.push(Math.sqrt(fSum / ch.length))

    this._buf.push(Float32Array.from(ch))
    this._samples += ch.length

    if (this._samples >= this._target) {
      // ── Concatenar frames ────────────────────────────────────────────────
      const out = new Float32Array(this._samples)
      let off = 0
      for (const f of this._buf) { out.set(f, off); off += f.length }

      // ── Pase único: RMS, diff-energy y ZCR ──────────────────────────────
      let rmsSum  = 0
      let diffSum = 0
      let zcr     = 0

      for (let i = 0; i < out.length; i++) {
        rmsSum += out[i] * out[i]
        if (i > 0) {
          const d = out[i] - out[i - 1]
          diffSum += d * d
          if ((out[i] >= 0) !== (out[i - 1] >= 0)) zcr++
        }
      }

      const rms        = Math.sqrt(rmsSum / out.length)
      const normalZcr  = zcr / out.length
      const specWeight = rmsSum > 0 ? Math.sqrt(diffSum / rmsSum) : 0

      // ── CV de energía por frame ──────────────────────────────────────────
      const n    = this._frameRms.length
      const mean = this._frameRms.reduce((a, b) => a + b, 0) / n
      const vari = this._frameRms.reduce((a, b) => a + (b - mean) ** 2, 0) / n
      const cv   = mean > 0 ? Math.sqrt(vari) / mean : 0

      // ── Decisión VAD ─────────────────────────────────────────────────────
      const isSpeech =
        rms        >= SILENCE_THRESH &&
        cv         >= MIN_CV         &&
        specWeight >= MIN_SPEC       &&
        specWeight <= MAX_SPEC       &&
        normalZcr  >= MIN_ZCR        &&
        normalZcr  <= MAX_ZCR

      if (isSpeech) {
        this.port.postMessage(out, [out.buffer])
      }

      this._buf      = []
      this._samples  = 0
      this._frameRms = []
    }

    return true
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor)
`
