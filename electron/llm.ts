import { ipcMain, type BrowserWindow } from 'electron'
import { Ollama } from 'ollama'
import { v4 as uuidv4 } from 'uuid'
import type { Note } from '../src/types.js'

// Ollama client is lazy-created / recreated when host changes
let ollamaClient: Ollama | null = null
let currentHost = ''

function getClient(host: string): Ollama {
  if (!ollamaClient || host !== currentHost) {
    ollamaClient = new Ollama({ host })
    currentHost = host
  }
  return ollamaClient
}

// Keep a rolling window of recent transcript text for context
const MAX_CONTEXT_CHARS = 800
let meetingContext = ''

export function appendContext(text: string): void {
  meetingContext = (meetingContext + ' ' + text).slice(-MAX_CONTEXT_CHARS).trim()
}

export async function generateNote(
  query: string,
  ollamaModel: string,
  ollamaHost: string,
): Promise<string> {
  const client = getClient(ollamaHost)

  const systemPrompt =
    'Eres un asistente técnico en una reunión. ' +
    'Genera notas CONCISAS (máximo 3 líneas) sobre consultas técnicas. ' +
    'Responde SOLO con la nota, sin preámbulos ni explicaciones adicionales. ' +
    'Usa viñetas si hay más de un punto.'

  const userPrompt =
    `Contexto de la reunión: "${meetingContext}"\n\n` +
    `Consulta detectada: "${query}"\n\n` +
    `Escribe una nota técnica breve y útil.`

  const response = await client.chat({
    model: ollamaModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    stream: false,
  })

  return response.message.content.trim()
}

export function setupLLMIPC(win: BrowserWindow): void {
  // Direct request from renderer (manual note generation)
  ipcMain.handle(
    'llm:generate-note',
    async (_e, query: string, ollamaModel: string, ollamaHost: string) => {
      return await generateNote(query, ollamaModel, ollamaHost)
    },
  )

  // Called internally by the transcriber after query detection
  // win is captured in closure so notes are always routed to the right window
  win.webContents.once('destroyed', () => {
    ipcMain.removeHandler('llm:generate-note')
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
