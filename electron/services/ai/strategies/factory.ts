import type { AIStrategy } from './strategy.js'
import { OllamaStrategy } from './ollama-strategy.js'
import { GeminiStrategy } from './gemini-strategy.js'
import { OpenAIStrategy } from './openai-strategy.js'
import { AnthropicStrategy } from './anthropic-strategy.js'

export type StrategyType = 'ollama' | 'openai' | 'gemini' | 'anthropic'

const strategies: Record<StrategyType, AIStrategy> = {
  ollama:    new OllamaStrategy(),
  openai:    new OpenAIStrategy(),
  gemini:    new GeminiStrategy(),
  anthropic: new AnthropicStrategy(),
}

export function getAIStrategy(type: StrategyType): AIStrategy {
  const strategy = strategies[type]
  if (!strategy) {
    throw new Error(`Strategy not found: ${type}`)
  }
  return strategy
}
