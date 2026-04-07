export type ColorTheme = 'midnight' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'amber'

export type AIProviderType = 'ollama' | 'openai' | 'gemini' | 'anthropic'

export interface AppSettings {
  isFirstRun:   boolean
  colorTheme:   ColorTheme
  opacity:      number    // 0.4 – 1.0
  alwaysOnTop:  boolean
  transcriptionEngine: 'local' | 'openai'
  whisperModel: string    // e.g. 'Xenova/whisper-tiny'
  language:     string    // 'es' | 'en' | 'auto'

  // AI Strategy Configuration
  aiProvider:   AIProviderType
  
  // Ollama
  ollamaModel:  string
  ollamaHost:   string

  // OpenAI
  openaiModel:  string
  openaiApiKey: string

  // Gemini
  geminiModel:  string
  geminiApiKey: string

  // Anthropic
  anthropicModel:  string
  anthropicApiKey: string
}
