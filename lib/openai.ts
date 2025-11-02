import OpenAI from 'openai'

/**
 * OpenAI Client
 *
 * IMPORTANT: GPT-5/GPT-5-mini does NOT support the following sampling parameters:
 * - temperature
 * - top_p
 * - presence_penalty
 * - frequency_penalty
 * - logprobs
 * - logit_bias
 *
 * Using these parameters will result in a 400 Bad Request error.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * GPT-5 models do not use temperature or other sampling parameters
 * This is a reminder to NOT include them in API calls
 */
export const GPT_5_MODELS = {
  GPT_5: 'gpt-5',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5_NANO: 'gpt-5-nano',
} as const

export const WHISPER_MODEL = 'whisper-1' as const
export const EMBEDDING_MODEL = 'text-embedding-3-small' as const
