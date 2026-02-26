/**
 * Preload script — runs in a sandboxed browser context with access to
 * Node.js built-ins.  Uses contextBridge to safely expose an ElectronAPI
 * surface to the React renderer without enabling nodeIntegration.
 */
import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  Note,
  TranscriptEntry,
  TranscriptResult,
  ModelProgressEvent,
} from '../src/types.js'

// Helper: register an ipcRenderer listener and return a cleanup function
function on<T>(channel: string, cb: (value: T) => void): () => void {
  const handler = (_e: Electron.IpcRendererEvent, value: T) => cb(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Transcription ──────────────────────────────────────────────────────────
  loadModel: (modelName: string) =>
    ipcRenderer.invoke('transcribe:load-model', modelName),

  isModelReady: () =>
    ipcRenderer.invoke('transcribe:is-ready'),

  transcribeChunk: (
    data: Float32Array,
    source: 'mic' | 'system',
    language: string,
    ollamaModel: string,
    ollamaHost: string,
  ): Promise<TranscriptResult> =>
    ipcRenderer.invoke(
      'transcribe:chunk',
      data.buffer,          // transfer ArrayBuffer — zero-copy when structured clone supports it
      source,
      language,
      ollamaModel,
      ollamaHost,
    ),

  // ── LLM ───────────────────────────────────────────────────────────────────
  generateNote: (query: string, ollamaModel: string, ollamaHost: string): Promise<string> =>
    ipcRenderer.invoke('llm:generate-note', query, ollamaModel, ollamaHost),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (patch: Partial<AppSettings>): Promise<void> =>
    ipcRenderer.invoke('settings:save', patch),

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow:    () => ipcRenderer.invoke('window:close'),

  setOpacity:     (value: number)  => ipcRenderer.invoke('window:set-opacity', value),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:set-always-on-top', value),

  // ── Events from main ──────────────────────────────────────────────────────
  onModelProgress: (cb: (ev: ModelProgressEvent) => void) =>
    on<ModelProgressEvent>('transcribe:model-progress', cb),

  onNoteGenerated: (cb: (note: Note) => void) =>
    on<Note>('note:generated', cb),

  onTranscriptNew: (cb: (entry: TranscriptEntry) => void) =>
    on<TranscriptEntry>('transcript:new', cb),
})
