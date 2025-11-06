export interface TranscriptionSegment {
    id: number;
    start: number;
    end: number;
    text: string;
}
export interface TranscriptionResult {
    text: string;
    duration?: number;
    language?: string;
    segments?: TranscriptionSegment[];
}
/**
 * Transcribe audio file using OpenAI Whisper API
 */
export declare function transcribeAudio(audioGcsPath: string): Promise<TranscriptionResult>;
/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
export declare function transcribeWithRetry(audioGcsPath: string, maxRetries?: number): Promise<TranscriptionResult>;
//# sourceMappingURL=transcription.d.ts.map