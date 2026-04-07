import './styles.css'
/**
 * Meeting page — the main view of the application.
 *
 * Orchestrates:
 *  - Live audio capture (mic + system) via useAudioRecording
 *  - Whisper transcription requests through the electron service
 *  - Ollama note generation (triggered from main process via IPC events)
 *  - Settings state (loaded from electron-store, applied live)
 */
import { useState, useEffect, useCallback } from 'react'

// Components
import TranscriptPanel from '../../components/TranscriptPanel/index.tsx'
import NotesPanel      from '../../components/NotesPanel/index.tsx'
import AudioVisualizer from '../../components/AudioVisualizer/index.tsx'
import Settings        from '../../components/Settings/index.tsx'

// Constants
import { DEFAULT_SETTINGS, COLOR_THEMES } from '../../constants/index.ts'

// Services
import { electron } from '../../services/electron.ts'

// Hooks
import { useAudioRecording } from '../../hooks/useAudioRecording.ts'
import { useElectronEvents } from '../../hooks/useElectronEvents.ts'

// Utils
import { resampleTo16k } from '../../utils/audio.ts'

// Types
import type { AppSettings }        from '../../types/settings.ts'
import type { TranscriptEntry }    from '../../types/transcript.ts'
import type { Note }               from '../../types/notes.ts'
import type { ModelProgressEvent } from '../../types/events.ts'

// ─── Local types ──────────────────────────────────────────────────────────────
type ModelStatus = 'loading' | 'ready' | 'error'

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function getStatusLabel(status: ModelStatus, progress: number, recording: boolean): string {
  if (status === 'loading') return `Cargando modelo… ${progress}%`
  if (status === 'error')   return 'Error cargando modelo'
  if (recording)            return 'Grabando'
  return 'Listo'
}

function getDotClass(status: ModelStatus, recording: boolean): string {
  if (status === 'loading') return 'loading'
  if (status === 'error')   return ''
  if (recording)            return 'recording'
  return 'ready'
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function MeetingPage() {
  // Settings
  const [settings,     setSettings]     = useState<AppSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

  // Model
  const [modelStatus,   setModelStatus]   = useState<ModelStatus>('loading')
  const [modelProgress, setModelProgress] = useState(0)

  // Data
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([])
  const [notes,       setNotes]       = useState<Note[]>([])
  const [generating,  setGenerating]  = useState(false)

  // Helper to extract current AI config based on provider
  const aiConfig = (() => {
    const p = settings.aiProvider
    if (p === 'openai')    return { provider: p, model: settings.openaiModel,    options: { apiKey: settings.openaiApiKey } }
    if (p === 'gemini')    return { provider: p, model: settings.geminiModel,    options: { apiKey: settings.geminiApiKey } }
    if (p === 'anthropic') return { provider: p, model: settings.anthropicModel, options: { apiKey: settings.anthropicApiKey } }
    return { provider: 'ollama' as const, model: settings.ollamaModel, options: { host: settings.ollamaHost } }
  })()

  // Audio chunk handler — forwards resampled PCM to main process for transcription
  const onChunk = useCallback(
    (raw: Float32Array, fromRate: number, source: 'mic' | 'system') => {
      if (modelStatus !== 'ready') return
      const pcm16 = resampleTo16k(raw, fromRate)
      electron
        .transcribeChunk(pcm16, source, settings.language, settings.transcriptionEngine, settings.openaiApiKey, aiConfig.provider, aiConfig.model, aiConfig.options)
        .catch((err: unknown) => console.warn('[transcribe]', err))
    },
    [modelStatus, settings.language, aiConfig],
  )

  const { isRecording, micAnalyser, systemAnalyser, start, stop } = useAudioRecording(onChunk)

  // Apply color theme to CSS variables whenever it changes
  useEffect(() => {
    const theme = COLOR_THEMES[settings.colorTheme]
    document.documentElement.style.setProperty('--accent',      theme.accent)
    document.documentElement.style.setProperty('--accent-glow', theme.glow)
    document.documentElement.style.setProperty('--accent-dim',  theme.accent + '2e')
  }, [settings.colorTheme])

  // Load persisted settings from electron-store on mount, then auto-fix Ollama model
  useEffect(() => {
    electron.getSettings().then(async saved => {
      setSettings(saved)
      electron.setOpacity(saved.opacity)
      if (saved.alwaysOnTop) electron.setAlwaysOnTop(true)

      // If the saved model isn't available in Ollama, switch to the first one that is
      const result = await electron.listOllamaModels(saved.ollamaHost)
      if (result.connected && result.models.length > 0 && !result.models.includes(saved.ollamaModel)) {
        const firstModel = result.models[0]
        setSettings(prev => ({ ...prev, ollamaModel: firstModel }))
        electron.saveSettings({ ollamaModel: firstModel })
      }
    })
  }, [])

  // Subscribe to IPC events from main process
  useElectronEvents({
    onModelProgress: useCallback((ev: ModelProgressEvent) => {
      setModelProgress(ev.progress)
      if (ev.status === 'ready') setModelStatus('ready')
    }, []),

    onNoteGenerated: useCallback((note: Note) => {
      setNotes(prev => [...prev, note])
      setGenerating(false)
    }, []),

    onTranscriptNew: useCallback((entry: TranscriptEntry) => {
      setTranscripts(prev => [...prev, entry])
      if (entry.isTechnicalQuery) setGenerating(true)
    }, []),
  })

  // Load (or reload) Whisper model — re-runs when user selects a different model
  useEffect(() => {
    if (settings.transcriptionEngine === 'openai') {
      setModelStatus('ready')
      setModelProgress(100)
      return
    }
    setModelStatus('loading')
    setModelProgress(0)
    electron.loadModel(settings.whisperModel).catch(() => setModelStatus('error'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.whisperModel, settings.transcriptionEngine])

  // Persist settings change + apply side-effects (opacity, alwaysOnTop)
  function handleSettingsChange(patch: Partial<AppSettings>) {
    setSettings(prev => ({ ...prev, ...patch }))
    electron.saveSettings(patch)
    if (patch.opacity     !== undefined) electron.setOpacity(patch.opacity)
    if (patch.alwaysOnTop !== undefined) electron.setAlwaysOnTop(patch.alwaysOnTop)
  }

  // Manual query from NotesPanel
  const handleManualQuery = useCallback((query: string) => {
    setGenerating(true)
    electron
      .generateNote(query, aiConfig.provider, aiConfig.model, aiConfig.options)
      .then(noteText => {
        if (noteText) {
          const note = {
            id:          crypto.randomUUID(),
            text:        noteText,
            triggerText: query,
            timestamp:   Date.now(),
            confidence:  1,
          }
          setNotes(prev => [...prev, note])
        }
      })
      .catch((err: unknown) => console.warn('[manual query]', err))
      .finally(() => setGenerating(false))
  }, [aiConfig])

  const statusLabel = getStatusLabel(modelStatus, modelProgress, isRecording)
  const dotClass    = getDotClass(modelStatus, isRecording)

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (modelStatus === 'loading') {
    return (
      <div className="model-overlay">
        <div className="model-title">Cargando Whisper</div>
        <div className="model-sub">
          {settings.whisperModel} — descarga automática en primera ejecución
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${modelProgress}%` }} />
        </div>
        <div className="model-sub">{modelProgress}%</div>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-logo">
          Meeting<span className="logo-sub">Mind</span>
          <span className="pro-badge">PRO</span>
        </div>

        <div className="titlebar-status">
          <div className={`status-dot ${dotClass}`} />
          {statusLabel}
        </div>

        <div className="titlebar-spacer" />

        <div className="titlebar-controls">
          <button
            className={`rec-btn${isRecording ? ' recording' : ''}`}
            onClick={isRecording ? stop : start}
            disabled={modelStatus !== 'ready'}
          >
            {isRecording ? '⬛ Detener' : '⬤ Iniciar'}
          </button>

          <button className="tb-icon-btn" title="Configuración" onClick={() => setShowSettings(true)}>⚙</button>
          <button className="tb-icon-btn" title="Minimizar"     onClick={() => electron.minimizeWindow()}>─</button>
          <button className="tb-icon-btn" title="Maximizar"     onClick={() => electron.maximizeWindow()}>□</button>
          <button className="tb-icon-btn close" title="Cerrar"  onClick={() => electron.closeWindow()}>✕</button>
        </div>
      </div>

      {/* Content panels */}
      <div className="content">
        <TranscriptPanel entries={transcripts} />
        <NotesPanel
          notes={notes}
          generating={generating}
          aiProvider={settings.aiProvider}
          aiModel={aiConfig.model}
          onQuery={handleManualQuery}
        />
      </div>

      {/* Audio visualizer */}
      <AudioVisualizer
        micAnalyser={micAnalyser}
        systemAnalyser={systemAnalyser}
        isRecording={isRecording}
      />

      {/* Bottom status bar */}
      <div className="status-bar">
        <div className="status-bar-item">
          <span className={`status-dot-sm${isRecording ? '' : ' inactive'}`} />
          INPUT: {isRecording ? 'GRABANDO' : 'DEFAULT AUDIO DEVICE'}
        </div>
        <span className="status-bar-sep">|</span>
        <div className="status-bar-item">
          <span className="status-dot-sm" />
          IA: {settings.aiProvider.toUpperCase()} ({aiConfig.model})
        </div>
        <div className="status-bar-right status-bar-item">
          Whisper: {settings.whisperModel.split('/').pop()}
        </div>
      </div>

      {/* Settings overlay */}
      {showSettings && (
        <Settings
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
