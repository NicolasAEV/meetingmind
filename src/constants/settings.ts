import type { AppSettings } from '../types/settings.ts'

export const DEFAULT_SETTINGS: AppSettings = {
  colorTheme:   'midnight',
  opacity:       0.95,
  alwaysOnTop:   false,
  transcriptionEngine: 'local',
  whisperModel: 'Xenova/whisper-large-v3',
  language:     'es',

  aiProvider:   'ollama',
  
  ollamaModel:  'llama3.2',
  ollamaHost:   'http://localhost:11434',

  openaiModel:  'gpt-4o-mini',
  openaiApiKey: '',

  geminiModel:  'gemini-1.5-flash',
  geminiApiKey: '',

  anthropicModel:  'claude-3-5-sonnet-latest',
  anthropicApiKey: '',
}
