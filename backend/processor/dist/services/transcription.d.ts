export interface TranscriptionResult {
  text: string
  duration?: number
  language?: string
}
/**
 * Transcribe audio file using OpenAI Whisper API
 */
export declare function transcribeAudio(audioGcsPath: string): Promise<TranscriptionResult>
/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
export declare function transcribeWithRetry(
  audioGcsPath: string,
  maxRetries?: number
): Promise<TranscriptionResult>
//# sourceMappingURL=transcription.d.ts.map
