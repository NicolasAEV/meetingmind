import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import type { Note } from '../../types/notes.ts'

interface Props {
  notes:      Note[]
  generating: boolean
}

export default function NotesPanel({ notes, generating }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes.length, generating])

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-header-icon">📝</span>
        Notas automáticas
        {notes.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: .6 }}>
            {notes.length} notas
          </span>
        )}
      </div>

      <div className="panel-body">
        {notes.length === 0 && !generating ? (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <div className="empty-state-text">
              Las notas aparecerán al detectar consultas técnicas
            </div>
          </div>
        ) : (
          <>
            {notes.map(note => (
              <div key={note.id} className="note-card">
                <div className="note-trigger">
                  "{note.triggerText.slice(0, 80)}{note.triggerText.length > 80 ? '…' : ''}"
                </div>
                <div className="note-text">{note.text}</div>
                <div className="note-ts">{format(note.timestamp, 'HH:mm:ss')}</div>
              </div>
            ))}

            {generating && (
              <div className="note-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="spinner" />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  Generando nota con Ollama…
                </span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
