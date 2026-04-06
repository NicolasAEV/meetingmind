import { ipcMain, type BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { Note } from '../../../src/types/notes.js'
import { getAIStrategy, type StrategyType } from './strategies/factory.js'

// Keep a rolling window of recent transcript text for context
const MAX_CONTEXT_CHARS = 1200
let meetingContext = ''

export function appendContext(text: string): void {
  meetingContext = (meetingContext + ' ' + text).slice(-MAX_CONTEXT_CHARS).trim()
}

export async function generateNote(
  query: string,
  provider: StrategyType,
  model: string,
  options: Record<string, any>
): Promise<string> {
  const strategy = getAIStrategy(provider)
  return await strategy.generateNote(query, meetingContext, model, options)
}

export function setupLLMIPC(win: BrowserWindow): void {
  // Direct request from renderer (manual or auto note generation)
  ipcMain.handle(
    'llm:generate-note',
    async (_e, query: string, provider: StrategyType, model: string, options: Record<string, any>) => {
      try {
        return await generateNote(query, provider, model, options)
      } catch (err) {
        console.error('[llm:generate-note] Error:', err)
        return `Error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  )

  // Check connectivity and return available models (currently mainly for Ollama)
  ipcMain.handle('ollama:list-models', async (_e, host: string) => {
    try {
      const strategy = getAIStrategy('ollama')
      if ('listModels' in strategy && typeof strategy.listModels === 'function') {
        const models = await strategy.listModels({ host })
        return { connected: true, models }
      }
      return { connected: false, models: [], error: 'Not supported' }
    } catch (err) {
      return { connected: false, models: [] as string[], error: String(err) }
    }
  })

  // win is captured in closure so notes are always routed to the right window
  win.webContents.once('destroyed', () => {
    ipcMain.removeHandler('llm:generate-note')
    ipcMain.removeHandler('ollama:list-models')
  })
}

// Emit a generated note to the renderer
export function emitNote(
  win: BrowserWindow,
  triggerText: string,
  noteText: string,
  confidence: number,
): void {
  const note: Note = {
    id: uuidv4(),
    text: noteText,
    timestamp: Date.now(),
    triggerText,
    confidence,
  }
  win.webContents.send('note:generated', note)
}
