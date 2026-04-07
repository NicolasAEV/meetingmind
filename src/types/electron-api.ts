import type { AppSettings }       from './settings.ts'
import type { Note }               from './notes.ts'
import type { TranscriptEntry, TranscriptResult } from './transcript.ts'
import type { ModelProgressEvent } from './events.ts'

export interface ElectronAPI {
  // ── Transcription ──────────────────────────────────────────────────────────
  loadModel:      (modelName: string)    => Promise<void>
  isModelReady:   ()                     => Promise<boolean>
  transcribeChunk: (
    data:        Float32Array,
    source:      'mic' | 'system',
    language:    string,
    transcriptionEngine: 'local' | 'openai',
    openaiApiKey: string,
    aiProvider:  string,
    aiModel:     string,
    aiOptions:   Record<string, any>,
  ) => Promise<TranscriptResult>

  // ── LLM ───────────────────────────────────────────────────────────────────
  generateNote: (
    query:    string,
    provider: string,
    model:    string,
    options:  Record<string, any>,
  ) => Promise<string>

  listOllamaModels: (host: string) => Promise<{
    connected: boolean
    models:    string[]
    error?:    string
  }>

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings:  ()                          => Promise<AppSettings>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow:  () => Promise<void>
  maximizeWindow:  () => Promise<void>
  closeWindow:     () => Promise<void>
  setOpacity:      (value: number)  => Promise<void>
  setAlwaysOnTop:  (value: boolean) => Promise<void>

  // ── Events — each returns an unsubscribe function ─────────────────────────
  onModelProgress: (cb: (ev: ModelProgressEvent) => void)  => () => void
  onNoteGenerated: (cb: (note: Note) => void)               => () => void
  onTranscriptNew: (cb: (entry: TranscriptEntry) => void)   => () => void
}

// Extend globalThis so TypeScript knows about the injected bridge
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
