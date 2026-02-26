// Re-export barrel — types have been moved to src/types/ folder.
// This file is kept so existing IDE sessions don't show broken imports.
export type { TranscriptEntry, TranscriptResult } from './types/transcript.ts'
export type { Note }                               from './types/notes.ts'
export type { AppSettings, ColorTheme }            from './types/settings.ts'
export type { ModelProgressEvent }                 from './types/events.ts'
export type { ElectronAPI }                        from './types/electron-api.ts'
