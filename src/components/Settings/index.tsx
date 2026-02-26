import { useState } from 'react'
import type { AppSettings, ColorTheme } from '../../types/settings.ts'
import { COLOR_THEMES } from '../../constants/themes.ts'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose:  () => void
}

export default function Settings({ settings, onChange, onClose }: Props) {
  const [local, setLocal] = useState<AppSettings>({ ...settings })

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...local, [key]: value }
    setLocal(next)
    onChange({ [key]: value })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-panel">
        <div className="settings-title">⚙ Configuración</div>

        {/* ── Apariencia ─────────────────────────────────────────────────── */}
        <div className="settings-section">
          <span className="settings-label">Color del tema</span>
          <div className="color-swatches">
            {(Object.entries(COLOR_THEMES) as [ColorTheme, typeof COLOR_THEMES[ColorTheme]][]).map(
              ([key, theme]) => (
                <div className="swatch-wrap" key={key}>
                  <div
                    className={`swatch${local.colorTheme === key ? ' active' : ''}`}
                    style={{ background: theme.accent }}
                    onClick={() => update('colorTheme', key)}
                    title={theme.name}
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
            <label>Opacidad</label>
            <input
              type="range" min={0.4} max={1} step={0.01}
              value={local.opacity}
              onChange={e => update('opacity', parseFloat(e.target.value))}
            />
            <span className="val-badge">{Math.round(local.opacity * 100)}%</span>
          </div>

          <div className="settings-row">
            <label>Siempre visible</label>
            <input
              type="checkbox" checked={local.alwaysOnTop}
              onChange={e => update('alwaysOnTop', e.target.checked)}
            />
          </div>
        </div>

        {/* ── Transcripción ──────────────────────────────────────────────── */}
        <div className="settings-section">
          <span className="settings-label">Transcripción (Whisper)</span>

          <div className="settings-row">
            <label>Modelo</label>
            <select value={local.whisperModel} onChange={e => update('whisperModel', e.target.value)}>
              <option value="Xenova/whisper-tiny">whisper-tiny (rápido, ~150 MB)</option>
              <option value="Xenova/whisper-base">whisper-base (~290 MB)</option>
              <option value="Xenova/whisper-small">whisper-small (preciso, ~970 MB)</option>
            </select>
          </div>

          <div className="settings-row">
            <label>Idioma</label>
            <select value={local.language} onChange={e => update('language', e.target.value)}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="auto">Auto-detectar</option>
            </select>
          </div>
        </div>

        {/* ── Ollama ─────────────────────────────────────────────────────── */}
        <div className="settings-section">
          <span className="settings-label">Notas (Ollama)</span>

          <div className="settings-row">
            <label>Modelo</label>
            <input type="text" value={local.ollamaModel}
              onChange={e => update('ollamaModel', e.target.value)}
              placeholder="llama3.2"
            />
          </div>

          <div className="settings-row">
            <label>Host</label>
            <input type="text" value={local.ollamaHost}
              onChange={e => update('ollamaHost', e.target.value)}
              placeholder="http://localhost:11434"
            />
          </div>
        </div>

        <button className="settings-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  )
}
