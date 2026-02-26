import { useEffect } from 'react'
import { electron }  from '../services/electron.ts'
import type { ModelProgressEvent } from '../types/events.ts'
import type { Note }               from '../types/notes.ts'
import type { TranscriptEntry }    from '../types/transcript.ts'

interface Options {
  onModelProgress: (ev: ModelProgressEvent) => void
  onNoteGenerated: (note: Note)             => void
  onTranscriptNew: (entry: TranscriptEntry) => void
}

/**
 * Subscribes to all main-process IPC events and cleans up on unmount.
 * Callbacks are expected to be stable references (useCallback / state setters).
 */
export function useElectronEvents({ onModelProgress, onNoteGenerated, onTranscriptNew }: Options): void {
  useEffect(() => {
    const unsub1 = electron.onModelProgress(onModelProgress)
    const unsub2 = electron.onNoteGenerated(onNoteGenerated)
    const unsub3 = electron.onTranscriptNew(onTranscriptNew)
    return () => { unsub1(); unsub2(); unsub3() }
  // Callbacks are intentionally excluded — they are stable state-setter refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
