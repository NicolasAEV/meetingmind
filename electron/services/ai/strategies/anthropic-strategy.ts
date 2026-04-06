import Anthropic from '@anthropic-ai/sdk'
import type { AIStrategy } from './strategy.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './utils.js'

export class AnthropicStrategy implements AIStrategy {
  private anthropic: Anthropic | null = null
  private currentKey: string = ''

  private getClient(apiKey: string): Anthropic {
    if (!this.anthropic || apiKey !== this.currentKey) {
      this.anthropic = new Anthropic({ apiKey })
      this.currentKey = apiKey
    }
    return this.anthropic
  }

  async generateNote(
    query: string,
    context: string,
    model: string,
    options: { apiKey: string }
  ): Promise<string> {
    const client = this.getClient(options.apiKey)
    const userPrompt = buildUserPrompt(query, context)

    const response = await client.messages.create({
      model,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 256,
    })

    const textContent = response.content.find(c => c.type === 'text')
    return textContent && 'text' in textContent ? textContent.text.trim() : ''
  }
}
