import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

/**
 * Get OpenAI client instance (lazy initialization)
 * This prevents OPENAI_API_KEY from being accessed during build time
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiInstance
}
