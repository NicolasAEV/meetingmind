export type ColorTheme = 'midnight' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'amber'

export interface AppSettings {
  colorTheme:   ColorTheme
  opacity:      number    // 0.4 – 1.0
  alwaysOnTop:  boolean
  whisperModel: string    // e.g. 'Xenova/whisper-tiny'
  ollamaModel:  string    // e.g. 'llama3.2'
  ollamaHost:   string    // e.g. 'http://localhost:11434'
  language:     string    // 'es' | 'en' | 'auto'
}
