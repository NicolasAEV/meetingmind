/**
 * Shared constants and utilities for AI strategies.
 */

export const SYSTEM_PROMPT =
  'Eres un asistente técnico en una reunión. ' +
  'Genera notas CONCISAS (máximo 3 líneas) sobre consultas técnicas. ' +
  'Responde SOLO con la nota, sin preámbulos ni explicaciones adicionales. ' +
  'Usa viñetas si hay más de un punto.'

export function buildUserPrompt(query: string, context: string): string {
  return (
    `Contexto de la reunión: "${context}"\n\n` +
    `Consulta detectada: "${query}"\n\n` +
    `Escribe una nota técnica breve y útil.`
  )
}
