import { Ollama } from 'ollama'
import type { AIStrategy } from './strategy.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './utils.js'

export class OllamaStrategy implements AIStrategy {
  private ollama: Ollama | null = null
  private currentHost: string = ''

  private getClient(host: string): Ollama {
    if (!this.ollama || host !== this.currentHost) {
      this.ollama = new Ollama({ host })
      this.currentHost = host
    }
    return this.ollama
  }

  async generateNote(
    query: string,
    context: string,
    model: string,
    options: { host: string }
  ): Promise<string> {
    const client = this.getClient(options.host)
    const userPrompt = buildUserPrompt(query, context)

    const response = await client.chat({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt    },
      ],
      stream: false,
    })

    return response.message.content.trim()
  }

  async listModels(options: { host: string }): Promise<string[]> {
    const client = this.getClient(options.host)
    const { models } = await client.list()
    return models.map(m => m.name)
  }
}
