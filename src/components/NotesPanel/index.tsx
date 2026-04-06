import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Note } from '../../types/notes.ts'

interface Props {
  readonly notes:       Note[]
  readonly generating:  boolean
  readonly aiProvider:  string
  readonly aiModel:     string
  readonly onQuery:     (query: string) => void
}

/** Derive a short title from the trigger text (first ~5 words capitalized) */
function deriveTitle(triggerText: string): string {
  const words = triggerText.trim().split(/\s+/).slice(0, 5).join(' ')
  return words.length < triggerText.trim().length ? `${words}…` : words
}

/** Detect if note text looks like a code/technical response */
function isCodeNote(text: string): boolean {
  return /```|const |function |import |class |def |<\/|=>/.test(text)
}

export default function NotesPanel({ notes, generating, aiProvider, aiModel, onQuery }: Props) {
  const bottomRef  = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes.length, generating])

  const handleSend = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed || generating) return
    onQuery(trimmed)
    setQuery('')
  }, [query, generating, onQuery])

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <span className="panel-header-icon">✦</span>
        {'NOTAS AUTOMÁTICAS'}
        <span className="panel-badge" title={`${aiProvider}: ${aiModel}`}>{aiModel}</span>
      </div>

      <div className="panel-body" style={{ flex: 1 }}>
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
                <div className="note-card-hdr">
                  <span className="note-card-icon">{isCodeNote(note.text) ? '<>' : 'ⓘ'}</span>
                  <span className="note-card-title">{deriveTitle(note.triggerText)}</span>
                  <span className="note-card-time">
                    {formatDistanceToNow(note.timestamp, { addSuffix: true, locale: es })}
                  </span>
                </div>
                <div className="note-card-body">
                  <div className="note-trigger">
                    "{note.triggerText.slice(0, 100)}{note.triggerText.length > 100 ? '…' : ''}"
                  </div>
                  <div className="note-text">{note.text}</div>
                </div>
              </div>
            ))}

            {generating && (
              <div className="note-card">
                <div className="note-card-hdr">
                  <span className="note-card-icon">◌</span>
                  <span className="note-card-title" style={{ color: 'var(--text-muted)' }}>
                    Generando nota…
                  </span>
                </div>
                <div className="note-card-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="spinner" />
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Procesando con {aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)}…
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Manual query bar */}
      <div className="notes-query-bar">
        <input
          className="notes-query-input"
          type="text"
          placeholder="Hacer una pregunta técnica…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={generating}
        />
        <button
          className="notes-send-btn"
          onClick={handleSend}
          disabled={!query.trim() || generating}
          title="Enviar consulta"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
