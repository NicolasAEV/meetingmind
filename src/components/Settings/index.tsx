import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ColorTheme } from '../../types/settings.ts'
import { COLOR_THEMES } from '../../constants/themes.ts'
import { WHISPER_MODELS, WHISPER_MODEL_GROUPS } from '../../constants/whisper.ts'
import { electron } from '../../services/electron.ts'

type SettingsTab = 'visual' | 'audio' | 'ai' | 'files'
type OllamaStatus = 'idle' | 'loading' | 'ok' | 'error'

const STATUS_LABEL: Record<OllamaStatus, string> = {
  idle:    'Sin verificar',
  loading: 'Conectando…',
  ok:      'Conectado',
  error:   'Sin conexión',
}

const TABS: { id: SettingsTab; icon: string; label: string }[] = [
  { id: 'visual', icon: '🎨', label: 'Visual'          },
  { id: 'audio',  icon: '🎙', label: 'Audio & Whisper' },
  { id: 'ai',     icon: '🤖', label: 'IA (Ollama/API)' },
  { id: 'files',  icon: '📂', label: 'Archivos'        },
]

interface Props {
  readonly settings: AppSettings
  readonly onChange: (patch: Partial<AppSettings>) => void
  readonly onClose:  () => void
}

export default function Settings({ settings, onChange, onClose }: Props) {
  const [local,      setLocal]      = useState<AppSettings>({ ...settings })
  const [initial]                   = useState<AppSettings>({ ...settings })
  const [activeTab,  setActiveTab]  = useState<SettingsTab>('visual')

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('idle')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  const checkOllama = useCallback(async (host?: string) => {
    const target = host ?? local.ollamaHost
    setOllamaStatus('loading')
    try {
      const result = await electron.listOllamaModels(target)
      if (result.connected) {
        setOllamaModels(result.models)
        setOllamaStatus('ok')
        if (result.models.length > 0 && !result.models.includes(local.ollamaModel)) {
          update('ollamaModel', result.models[0])
        }
      } else {
        setOllamaModels([])
        setOllamaStatus('error')
      }
    } catch {
      setOllamaModels([])
      setOllamaStatus('error')
    }
  }, [local.ollamaHost, local.ollamaModel])

  // Check Ollama when AI tab is first opened
  useEffect(() => {
    if (activeTab === 'ai' && ollamaStatus === 'idle') {
      checkOllama()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCancel() {
    onChange(initial)
    onClose()
  }

  function handleSave() {
    onChange(local)
    onClose()
  }

  // ── Tab content renderers ────────────────────────────────────────────────────

  function renderVisual() {
    return (
      <>
        <div className="settings-section-hdr">Tema de color</div>
        <div className="color-swatches">
          {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(
            ([key, theme]) => (
              <div className="swatch-wrap" key={key}>
                <button
                  className={`swatch${local.colorTheme === key ? ' active' : ''}`}
                  style={{ background: theme.accent }}
                  onClick={() => update('colorTheme', key)}
                  title={theme.name}
                  aria-label={theme.name}
                  aria-pressed={local.colorTheme === key}
                />
                <span className="swatch-label">{theme.name}</span>
              </div>
            ),
          )}
        </div>

        <div className="settings-section-hdr mt">Ventana</div>

        <div className="settings-row">
          <label htmlFor="setting-opacity" className="settings-row-text">Opacidad</label>
          <input
            id="setting-opacity"
            type="range" min={0.4} max={1} step={0.01}
            value={local.opacity}
            onChange={e => update('opacity', Number.parseFloat(e.target.value))}
          />
          <span className="val-badge">{Math.round(local.opacity * 100)}%</span>
        </div>

        <div className="settings-row">
          <span className="settings-row-text">Siempre visible</span>
          <label className="toggle-switch" htmlFor="setting-always-on-top" aria-label="Siempre visible">
            <input
              id="setting-always-on-top"
              type="checkbox"
              checked={local.alwaysOnTop}
              onChange={e => update('alwaysOnTop', e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </label>
        </div>
      </>
    )
  }

  function renderAudio() {
    return (
      <>
        <div className="settings-section-hdr">Motor de Transcripción</div>
        <div className="settings-row">
          <label htmlFor="setting-transcription-engine" className="settings-row-text">Proveedor Transcripción</label>
          <select
            id="setting-transcription-engine"
            value={local.transcriptionEngine}
            onChange={e => update('transcriptionEngine', e.target.value as any)}
          >
            <option value="local">Local (@xenova/transformers)</option>
            <option value="openai">OpenAI API (Cloud)</option>
          </select>
        </div>

        {local.transcriptionEngine === 'local' && (
          <>
            <div className="settings-section-hdr mt">Modelo Whisper Local</div>
            <div className="settings-row">
              <label htmlFor="setting-whisper-model" className="settings-row-text">Modelo</label>
              <select
                id="setting-whisper-model"
                value={local.whisperModel}
                onChange={e => update('whisperModel', e.target.value)}
              >
                {(Object.entries(WHISPER_MODEL_GROUPS) as [keyof typeof WHISPER_MODEL_GROUPS, string][]).map(
                  ([groupKey, groupLabel]) => (
                    <optgroup key={groupKey} label={groupLabel}>
                      {WHISPER_MODELS.filter(m => m.group === groupKey).map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
            </div>
          </>
        )}

        {local.transcriptionEngine === 'openai' && (
          <div className="settings-row mt">
            <span className="settings-row-text" style={{ fontSize: '0.9em', color: '#888' }}>
              ℹ️ Se requiere tener configurada la API Key de OpenAI en la pestaña "IA (Ollama/API)".
            </span>
          </div>
        )}

        <div className="settings-section-hdr mt">Idioma</div>

        <div className="settings-row">
          <label htmlFor="setting-language" className="settings-row-text">Idioma</label>
          <select
            id="setting-language"
            value={local.language}
            onChange={e => update('language', e.target.value)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="auto">Auto-detectar</option>
          </select>
        </div>
      </>
    )
  }

  function renderAI() {
    const isOllama = local.aiProvider === 'ollama'

    return (
      <>
        <div className="settings-section-hdr">Proveedor de IA</div>
        <div className="settings-row">
          <label htmlFor="setting-ai-provider" className="settings-row-text">Proveedor</label>
          <select
            id="setting-ai-provider"
            value={local.aiProvider}
            onChange={e => update('aiProvider', e.target.value as any)}
          >
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="gemini">Google Gemini</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        {isOllama && (
          <>
            <div className="settings-section-hdr mt">
              Ollama
              <div className="ollama-status-bar" style={{ marginLeft: 'auto' }}>
                <span className={`ollama-dot ollama-dot--${ollamaStatus}`} />
                <span className="ollama-status-text">{STATUS_LABEL[ollamaStatus]}</span>
                <button
                  className="ollama-refresh-btn"
                  onClick={() => checkOllama()}
                  disabled={ollamaStatus === 'loading'}
                  title="Verificar conexión"
                >↻</button>
              </div>
            </div>

            <div className="settings-row">
              <label htmlFor="setting-ollama-model" className="settings-row-text">Modelo</label>
              {ollamaModels.length > 0 ? (
                <select
                  id="setting-ollama-model"
                  value={ollamaModels.includes(local.ollamaModel) ? local.ollamaModel : ollamaModels[0]}
                  onChange={e => update('ollamaModel', e.target.value)}
                >
                  {ollamaModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="setting-ollama-model"
                  type="text"
                  value={local.ollamaModel}
                  onChange={e => update('ollamaModel', e.target.value)}
                  placeholder="llama3.2"
                />
              )}
            </div>

            <div className="settings-row">
              <label htmlFor="setting-ollama-host" className="settings-row-text">Host</label>
              <input
                id="setting-ollama-host"
                type="text"
                value={local.ollamaHost}
                onChange={e => update('ollamaHost', e.target.value)}
                onBlur={e => checkOllama(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          </>
        )}

        {local.aiProvider === 'openai' && (
          <>
            <div className="settings-section-hdr mt">Configuración OpenAI</div>
            <div className="settings-row">
              <label htmlFor="setting-openai-model" className="settings-row-text">Modelo</label>
              <input
                id="setting-openai-model"
                type="text"
                value={local.openaiModel}
                onChange={e => update('openaiModel', e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="settings-row">
              <label htmlFor="setting-openai-key" className="settings-row-text">API Key</label>
              <input
                id="setting-openai-key"
                type="password"
                value={local.openaiApiKey}
                onChange={e => update('openaiApiKey', e.target.value)}
                placeholder="sk-..."
              />
            </div>
          </>
        )}

        {local.aiProvider === 'gemini' && (
          <>
            <div className="settings-section-hdr mt">Configuración Gemini</div>
            <div className="settings-row">
              <label htmlFor="setting-gemini-model" className="settings-row-text">Modelo</label>
              <input
                id="setting-gemini-model"
                type="text"
                value={local.geminiModel}
                onChange={e => update('geminiModel', e.target.value)}
                placeholder="gemini-1.5-flash"
              />
            </div>
            <div className="settings-row">
              <label htmlFor="setting-gemini-key" className="settings-row-text">API Key</label>
              <input
                id="setting-gemini-key"
                type="password"
                value={local.geminiApiKey}
                onChange={e => update('geminiApiKey', e.target.value)}
                placeholder="AIza..."
              />
            </div>
          </>
        )}

        {local.aiProvider === 'anthropic' && (
          <>
            <div className="settings-section-hdr mt">Configuración Anthropic</div>
            <div className="settings-row">
              <label htmlFor="setting-anthropic-model" className="settings-row-text">Modelo</label>
              <input
                id="setting-anthropic-model"
                type="text"
                value={local.anthropicModel}
                onChange={e => update('anthropicModel', e.target.value)}
                placeholder="claude-3-5-sonnet-latest"
              />
            </div>
            <div className="settings-row">
              <label htmlFor="setting-anthropic-key" className="settings-row-text">API Key</label>
              <input
                id="setting-anthropic-key"
                type="password"
                value={local.anthropicApiKey}
                onChange={e => update('anthropicApiKey', e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
          </>
        )}
      </>
    )
  }

  function renderFiles() {
    return (
      <>
        <div className="settings-section-hdr">Exportación</div>
        <div className="empty-state" style={{ paddingTop: 32 }}>
          <div className="empty-state-icon">📂</div>
          <div className="empty-state-text">Sin opciones de archivo por el momento</div>
        </div>
      </>
    )
  }

  const tabContent = {
    visual: renderVisual,
    audio:  renderAudio,
    ai:     renderAI,
    files:  renderFiles,
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="settings-overlay">
      <button
        className="settings-backdrop"
        aria-label="Cerrar configuración"
        onClick={handleCancel}
      />

      <div className="settings-modal">
        {/* Header */}
        <div className="settings-modal-hdr">
          <span>⚙ Configuración</span>
        </div>

        {/* Body: sidebar + content */}
        <div className="settings-modal-body">
          <nav className="settings-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`settings-nav-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings-content-area">
            {tabContent[activeTab]()}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-modal-ftr">
          <button className="btn-cancel" onClick={handleCancel}>Cancelar</button>
          <button className="btn-save"   onClick={handleSave}>Cerrar y Guardar</button>
        </div>
      </div>
    </div>
  )
}
