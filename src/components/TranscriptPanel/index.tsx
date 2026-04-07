import './styles.css'
import { useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import type { TranscriptEntry } from '../../types/transcript.ts'

interface Props {
  readonly entries: TranscriptEntry[]
}

export default function TranscriptPanel({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  const handleExport = useCallback(() => {
    const text = entries
      .map(e => `[${format(e.timestamp, 'HH:mm:ss')}] ${e.source === 'mic' ? 'MIC' : 'SYS'}: ${e.text}`)
      .join('\n')
    navigator.clipboard.writeText(text).catch(console.error)
  }, [entries])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-header-icon">🎙</span>
        Transcripción en vivo
        {entries.length > 0 && (
          <button className="export-btn" onClick={handleExport} title="Copiar al portapapeles">
            ↑ Exportar
          </button>
        )}
      </div>

      <div className="panel-body">
        {entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎤</div>
            <div className="empty-state-text">Presiona Iniciar para comenzar a transcribir</div>
          </div>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className={`transcript-entry-v2${entry.isTechnicalQuery ? ' technical' : ''}`}
            >
              <div className={`transcript-avatar ${entry.source}`}>
                {entry.source === 'mic' ? 'M' : 'S'}
              </div>
              <div className="transcript-entry-body">
                <div className="transcript-entry-meta">
                  <span className={`transcript-entry-source ${entry.source}`}>
                    {entry.source === 'mic' ? 'Micrófono' : 'Sistema'}
                  </span>
                  <span className="transcript-entry-time">
                    {format(entry.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
                <div className="transcript-entry-text">{entry.text}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
