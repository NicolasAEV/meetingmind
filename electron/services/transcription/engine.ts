/**
 * Whisper transcription via @xenova/transformers (ONNX Runtime).
 *
 * Runs in the Electron main process (Node.js).
 * @xenova/transformers uses onnxruntime-node which ships prebuilt binaries for
 * Node.js 20/22 — compatible with Electron 40 (Node 22) without compilation.
 *
 * If you see a native-module error on first run, execute:
 *   npx electron-rebuild -f -w @xenova/transformers
 */
import { ipcMain, app, type BrowserWindow } from 'electron'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { detectTechnicalQuery }  from './detector.js'
import { appendContext, generateNote, emitNote } from '../ai/orchestrator.js'
import type { TranscriptEntry, TranscriptResult, ModelProgressEvent } from '../../../src/types.js'

// ─── Dynamic import so the app starts even if onnxruntime fails to load ───────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null
let modelLoading = false
let modelReady = false

type ProgressCb = (ev: ModelProgressEvent) => void

async function loadWhisperModel(modelName: string, onProgress: ProgressCb): Promise<void> {
  if (asr || modelLoading) return
  modelLoading = true

  try {
    // Configure cache directory to userData so models persist between updates
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir = path.join(app.getPath('userData'), '.models')
    env.allowRemoteModels = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asr = await pipeline('automatic-speech-recognition', modelName, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => {
        if (typeof p?.progress === 'number') {
          onProgress({ progress: Math.round(p.progress), status: p.status ?? '' })
        }
      },
    })
    modelReady = true
    // Notify renderer that the model is truly ready (all files loaded + pipeline init)
    onProgress({ progress: 100, status: 'ready' })
  } catch (err) {
    modelLoading = false
    throw err
  }
  modelLoading = false
}

// Mínimo de muestras a 16 kHz para intentar transcribir (evita chunks demasiado cortos)
const MIN_SAMPLES_16K = 16000 * 10  // 10 segundos a 16 kHz

// Umbral de RMS: si el chunk llega aquí ya pasó el filtro del worklet,
// pero hacemos una segunda comprobación por si acaso (e.g. audio de sistema muy bajo)
const MIN_RMS = 0.001

function rms(data: Float32Array): number {
  let sum = 0
  for (const sample of data) sum += sample * sample
  return Math.sqrt(sum / data.length)
}

// Whisper genera texto espurio (alucinaciones) cuando el audio contiene
// silencio, música o ruido no-vocal. Este set filtra las más comunes.
const HALLUCINATION_PATTERNS = [
  // Silencio / puntuación sola
  /^[\s.,!?…\-–—]*$/,
  // Frases de cortesía repetitivas
  /^(gracias|thank you|thanks|bye|adiós|suscríbete)[.!,\s]*$/i,
  // Marcadores de subtítulos / accesibilidad
  /^(subtítulos|subtitulos|subtitles|captions?|transcri)/i,
  // URLs o texto técnico espurio
  /^(www\.|http|@)/i,
  // Marcadores de música que Whisper inserta
  /[♪♫🎵🎶]/u,
  /^\[?(music|música|musica|song|canción|instrumental|applause|laughter|silence|ambient)\]?\.?$/i,
  // Contenido formado solo por etiquetas entre corchetes/paréntesis
  /^(\s*[[({].*?[\])}]\s*)+$/,
  // Texto extremadamente corto (< 3 chars) que no es significativo
  /^.{0,2}$/,
  // Repetición de palabras (alucinación de bucle)
  /^(.{3,}?)\s+\1(\s+\1)+$/,
]

function isHallucination(text: string): boolean {
  return HALLUCINATION_PATTERNS.some(p => p.test(text.trim()))
}

async function transcribeBuffer(audioData: Float32Array, language: string): Promise<string> {
  if (!asr) throw new Error('Whisper model not loaded')

  // Descartar chunks demasiado cortos o silenciosos antes de llamar a Whisper
  if (audioData.length < MIN_SAMPLES_16K) return ''
  if (rms(audioData) < MIN_RMS) return ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await asr(audioData, {
    language:          language === 'auto' ? undefined : language,
    task:              'transcribe',
    return_timestamps: false,
  })

  const text = Array.isArray(result)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? result.map((r: any) => String(r?.text ?? '')).join(' ').trim()
    : String(result?.text ?? '').trim()

  // Descartar alucinaciones típicas de Whisper en audio silencioso
  if (isHallucination(text)) return ''

  return text
}

// ─── IPC setup ────────────────────────────────────────────────────────────────

export function setupTranscriberIPC(win: BrowserWindow): void {
  // Load model on request from renderer
  ipcMain.handle('transcribe:load-model', async (_e, modelName: string) => {
    await loadWhisperModel(modelName, (ev) => {
      win.webContents.send('transcribe:model-progress', ev)
    })
  })

  ipcMain.handle('transcribe:is-ready', () => modelReady)

  // Receive a 16 kHz mono Float32Array chunk from renderer
  ipcMain.handle(
    'transcribe:chunk',
    async (
      _e,
      buffer: ArrayBuffer,
      source: 'mic' | 'system',
      language: string,
      aiProvider: any, // StrategyType
      aiModel: string,
      aiOptions: Record<string, any>,
    ): Promise<TranscriptResult> => {
      const audioData = new Float32Array(buffer)
      const text = await transcribeBuffer(audioData, language)

      if (!text) {
        return { text: '', source, isTechnicalQuery: false, confidence: 0 }
      }

      const detection = detectTechnicalQuery(text)
      appendContext(text)

      // Emit to renderer as a TranscriptEntry for the live panel
      const entry: TranscriptEntry = {
        id: uuidv4(),
        text,
        timestamp: Date.now(),
        source,
        isTechnicalQuery: detection.isTechnical,
      }
      win.webContents.send('transcript:new', entry)

      // Async note generation — does not block the transcript response
      if (detection.isTechnical) {
        generateNote(text, aiProvider, aiModel, aiOptions)
          .then((noteText) => {
            if (noteText) emitNote(win, text, noteText, detection.confidence)
          })
          .catch((err: unknown) => {
            console.error('[LLM] Note generation failed:', err)
          })
      }

      return {
        text,
        source,
        isTechnicalQuery: detection.isTechnical,
        confidence: detection.confidence,
      }
    },
  )

  win.webContents.once('destroyed', () => {
    ipcMain.removeHandler('transcribe:load-model')
    ipcMain.removeHandler('transcribe:is-ready')
    ipcMain.removeHandler('transcribe:chunk')
  })
}
