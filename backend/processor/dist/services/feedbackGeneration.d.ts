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
export declare function generateFeedback(
  transcriptText: string,
  status: string,
  durationSeconds: number,
  projectId: string | null
): Promise<FeedbackGenerationResult>
export {}
//# sourceMappingURL=feedbackGeneration.d.ts.map
