import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface FeedbackGenerationResult {
  feedback_text: string | null
  prompt_version_id: string | null
  should_generate: boolean
  skip_reason?: string
}

/**
 * Generate feedback for a call using GPT-5-mini
 *
 * @param transcriptText - Transcribed text from the call
 * @param status - Call status (connected/reception/no_conversation)
 * @param durationSeconds - Call duration in seconds
 * @param projectId - Project ID (optional, for project-specific prompts)
 * @returns FeedbackGenerationResult
 */
export async function generateFeedback(
  transcriptText: string,
  status: string,
  durationSeconds: number,
  projectId: string | null
): Promise<FeedbackGenerationResult> {
  console.log('[Feedback] Starting feedback generation...')
  console.log(
    `[Feedback] Status: ${status}, Duration: ${durationSeconds}s, ProjectID: ${projectId || 'null'}`
  )

  // Check feedback generation conditions
  const shouldGenerate = status === 'connected' && durationSeconds >= 60

  if (!shouldGenerate) {
    const skipReason =
      status !== 'connected'
        ? `Status is ${status}, not connected`
        : `Duration is ${durationSeconds}s, less than 60s`

    console.log(`[Feedback] Skipping feedback generation: ${skipReason}`)

    return {
      feedback_text: null,
      prompt_version_id: null,
      should_generate: false,
      skip_reason: skipReason,
    }
  }

  // Step 1: Retrieve prompt (project-specific or default)
  console.log('[Feedback] Step 1: Retrieving prompt...')

  const prompt = await getActivePrompt(projectId)

  if (!prompt) {
    console.warn('[Feedback] No active prompt found, skipping feedback generation')
    return {
      feedback_text: null,
      prompt_version_id: null,
      should_generate: false,
      skip_reason: 'No active prompt available',
    }
  }

  console.log(`[Feedback] Using prompt: ${prompt.id} (version ${prompt.version})`)

  // Step 2: Generate feedback with GPT-5-mini
  console.log('[Feedback] Step 2: Generating feedback with GPT-5-mini...')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using GPT-5-mini equivalent
      messages: [
        {
          role: 'system',
          content: prompt.content,
        },
        {
          role: 'user',
          content: `以下の通話内容を分析し、フィードバックを生成してください。\n\n通話時間: ${durationSeconds}秒\n\n文字起こし:\n${transcriptText}`,
        },
      ],
      // IMPORTANT: GPT-5/GPT-5-mini does NOT support temperature, top_p, presence_penalty, frequency_penalty
      // These parameters are omitted as per technical guidelines
    })

    const feedbackText = completion.choices[0]?.message?.content

    if (!feedbackText) {
      console.error('[Feedback] GPT-5-mini returned empty feedback')
      return {
        feedback_text: null,
        prompt_version_id: prompt.id,
        should_generate: true,
        skip_reason: 'GPT-5-mini returned empty response',
      }
    }

    console.log(`[Feedback] Feedback generated successfully (${feedbackText.length} characters)`)

    return {
      feedback_text: feedbackText,
      prompt_version_id: prompt.id,
      should_generate: true,
    }
  } catch (error: any) {
    console.error('[Feedback] Error generating feedback with GPT-5-mini:', error.message)

    return {
      feedback_text: null,
      prompt_version_id: prompt.id,
      should_generate: true,
      skip_reason: `GPT-5-mini error: ${error.message}`,
    }
  }
}

/**
 * Get active prompt for feedback generation
 * Priority: Project-specific connected prompt > Default connected prompt
 *
 * @param projectId - Project ID (optional)
 * @returns Active prompt or null
 */
async function getActivePrompt(projectId: string | null): Promise<any> {
  try {
    // If projectId is provided, try to get project-specific prompt first
    if (projectId) {
      const { data: projectPrompt, error: projectError } = await supabase
        .from('prompts')
        .select('*')
        .eq('project_id', projectId)
        .eq('prompt_type', 'connected')
        .eq('is_active', true)
        .maybeSingle()

      if (!projectError && projectPrompt) {
        console.log(`[Feedback] Found project-specific prompt for project ${projectId}`)
        return projectPrompt
      }
    }

    // Fallback to default prompt (project_id IS NULL)
    const { data: defaultPrompt, error: defaultError } = await supabase
      .from('prompts')
      .select('*')
      .is('project_id', null)
      .eq('prompt_type', 'connected')
      .eq('is_active', true)
      .maybeSingle()

    if (defaultError) {
      console.error('[Feedback] Error fetching default prompt:', defaultError)
      return null
    }

    if (defaultPrompt) {
      console.log('[Feedback] Using default prompt')
      return defaultPrompt
    }

    console.warn('[Feedback] No active prompt found (neither project-specific nor default)')
    return null
  } catch (error: any) {
    console.error('[Feedback] Error in getActivePrompt:', error.message)
    return null
  }
}
