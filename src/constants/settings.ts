import type { AppSettings } from '../types/settings.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  colorTheme:   'midnight',
  opacity:       0.95,
  alwaysOnTop:   false,
  whisperModel: 'Xenova/whisper-large-v3',
  ollamaModel:  'llama3.2',
  ollamaHost:   'http://localhost:11434',
  language:     'es',
}
