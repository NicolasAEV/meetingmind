import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import type { TranscriptEntry } from '../../types/transcript.ts'

interface Props {
  entries: TranscriptEntry[]
}

export default function TranscriptPanel({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-header-icon">🎙</span>
        Transcripción en vivo
        {entries.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: .6 }}>
            {entries.length} segmentos
          </span>
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
              className={`transcript-entry${entry.isTechnicalQuery ? ' technical' : ''}`}
            >
              <div className="transcript-meta">
                <span className={`source-badge ${entry.source}`}>
                  {entry.source === 'mic' ? 'MIC' : 'SYS'}
                </span>
                <span>{format(entry.timestamp, 'HH:mm:ss')}</span>
                {entry.isTechnicalQuery && (
                  <span className="query-badge">Consulta técnica</span>
                )}
              </div>
              <div className="transcript-text">{entry.text}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
