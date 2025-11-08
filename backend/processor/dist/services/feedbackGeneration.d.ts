import { TalkScriptAnalysisResult } from './talkScriptAnalysis';
interface FeedbackGenerationResult {
    feedback_text: string | null;
    prompt_version_id: string | null;
    should_generate: boolean;
    skip_reason?: string;
}
/**
 * Generate feedback for a call using GPT model
 * - Connected calls (60s+): Use 'connected' prompt with gpt-5-mini
 * - Reception calls: Use 'reception' prompt with gpt-5-nano
 *
 * @param transcriptText - Transcribed text from the call
 * @param status - Call status (connected/reception/no_conversation)
 * @param durationSeconds - Call duration in seconds
 * @param projectId - Project ID (optional, for project-specific prompts)
 * @param analysisResult - Talk script analysis result (optional, M3.3)
 * @returns FeedbackGenerationResult
 */
export declare function generateFeedback(transcriptText: string, status: string, durationSeconds: number, projectId: string | null, analysisResult?: TalkScriptAnalysisResult): Promise<FeedbackGenerationResult>;
export {};
//# sourceMappingURL=feedbackGeneration.d.ts.map