import OpenAI from 'openai'
import type { AIStrategy } from './strategy.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './utils.js'

export class OpenAIStrategy implements AIStrategy {
  private openai: OpenAI | null = null
  private currentKey: string = ''

  private getClient(apiKey: string): OpenAI {
    if (!this.openai || apiKey !== this.currentKey) {
      this.openai = new OpenAI({ apiKey })
      this.currentKey = apiKey
    }
    return this.openai
  }

  async generateNote(
    query: string,
    context: string,
    model: string,
    options: { apiKey: string }
  ): Promise<string> {
    const client = this.getClient(options.apiKey)
    const userPrompt = buildUserPrompt(query, context)

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt     },
      ],
      stream: false,
    })

    return response.choices[0].message.content?.trim() || ''
  }
}
