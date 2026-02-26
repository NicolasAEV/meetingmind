import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ColorTheme } from '../../types/settings.ts'
import { COLOR_THEMES } from '../../constants/themes.ts'
import { WHISPER_MODELS, WHISPER_MODEL_GROUPS } from '../../constants/whisper.ts'
import { electron } from '../../services/electron.ts'

type OllamaStatus = 'idle' | 'loading' | 'ok' | 'error'

const STATUS_LABEL: Record<OllamaStatus, string> = {
  idle:    'Sin verificar',
  loading: 'Conectando…',
  ok:      'Conectado',
  error:   'Sin conexión',
}

interface Props {
  readonly settings: AppSettings
  readonly onChange: (patch: Partial<AppSettings>) => void
  readonly onClose:  () => void
}

export default function Settings({ settings, onChange, onClose }: Props) {
  const [local, setLocal] = useState<AppSettings>({ ...settings })

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('idle')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...local, [key]: value }
    setLocal(next)
    onChange({ [key]: value })
  }

  const checkOllama = useCallback(async (host?: string) => {
    const target = host ?? local.ollamaHost
    setOllamaStatus('loading')
    try {
      const result = await electron.listOllamaModels(target)
      if (result.connected) {
        setOllamaModels(result.models)
        setOllamaStatus('ok')
      } else {
        setOllamaModels([])
        setOllamaStatus('error')
      }
    } catch {
      setOllamaModels([])
      setOllamaStatus('error')
    }
  }, [local.ollamaHost])

  // Auto-check on first open
  useEffect(() => { checkOllama() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="settings-overlay">
      <button
        className="settings-backdrop"
        aria-label="Cerrar configuración"
        onClick={onClose}
      />
      <div className="settings-panel">
        <div className="settings-title">⚙ Configuración</div>

        {/* ── Apariencia ─────────────────────────────────────────────────── */}
        <div className="settings-section">
          <span className="settings-label">Color del tema</span>
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
        </div>

        <div className="settings-section">
          <span className="settings-label">Transparencia y ventana</span>

          <div className="settings-row">
            <label htmlFor="setting-opacity">Opacidad</label>
            <input
              id="setting-opacity"
              type="range" min={0.4} max={1} step={0.01}
              value={local.opacity}
              onChange={e => update('opacity', Number.parseFloat(e.target.value))}
            />
            <span className="val-badge">{Math.round(local.opacity * 100)}%</span>
          </div>

          <div className="settings-row">
            <label htmlFor="setting-always-on-top">Siempre visible</label>
            <input
              id="setting-always-on-top"
              type="checkbox" checked={local.alwaysOnTop}
              onChange={e => update('alwaysOnTop', e.target.checked)}
            />
          </div>
        </div>

        {/* ── Transcripción ──────────────────────────────────────────────── */}
        <div className="settings-section">
          <span className="settings-label">Transcripción (Whisper)</span>

          <div className="settings-row">
            <label htmlFor="setting-whisper-model">Modelo</label>
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
                )
              )}
            </select>
          </div>

          <div className="settings-row">
            <label htmlFor="setting-language">Idioma</label>
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
        </div>

        {/* ── Ollama ─────────────────────────────────────────────────────── */}
        <div className="settings-section">
          <div className="ollama-section-header">
            <span className="settings-label">Notas (Ollama)</span>
            <div className="ollama-status-bar">
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
            <label htmlFor="setting-ollama-host">Host</label>
            <input
              id="setting-ollama-host"
              type="text"
              value={local.ollamaHost}
              onChange={e => update('ollamaHost', e.target.value)}
              onBlur={e => checkOllama(e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>

          <div className="settings-row">
            <label htmlFor="setting-ollama-model">Modelo</label>
            {ollamaModels.length > 0 ? (
              <select
                id="setting-ollama-model"
                value={local.ollamaModel}
                onChange={e => update('ollamaModel', e.target.value)}
              >
                {ollamaModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {!ollamaModels.includes(local.ollamaModel) && (
                  <option value={local.ollamaModel}>{local.ollamaModel}</option>
                )}
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
        </div>

        <button className="settings-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}
