import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIStrategy } from './strategy.js'
import { SYSTEM_PROMPT, buildUserPrompt } from './utils.js'

export class GeminiStrategy implements AIStrategy {
  private genAI: GoogleGenerativeAI | null = null
  private currentKey: string = ''

  private getClient(apiKey: string): GoogleGenerativeAI {
    if (!this.genAI || apiKey !== this.currentKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
      this.currentKey = apiKey
    }
    return this.genAI
  }

  async generateNote(
    query: string,
    context: string,
    model: string,
    options: { apiKey: string }
  ): Promise<string> {
    const ai = this.getClient(options.apiKey)
    const genModel = ai.getGenerativeModel({ 
      model,
      systemInstruction: SYSTEM_PROMPT
    })

    const userPrompt = buildUserPrompt(query, context)
    const result = await genModel.generateContent(userPrompt)
    return result.response.text().trim()
  }
}
