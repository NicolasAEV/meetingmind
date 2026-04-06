export interface AIStrategy {
  /**
   * Generates a concise technical note based on the query and recent meeting context.
   */
  generateNote(
    query: string,
    context: string,
    model: string,
    options: Record<string, any>
  ): Promise<string>

  /**
   * Optional: Returns a list of available models for the provider.
   */
  listModels?(options: Record<string, any>): Promise<string[]>
}
