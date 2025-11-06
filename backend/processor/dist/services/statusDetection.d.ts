export type CallStatus = 'connected' | 'reception' | 'no_conversation';
export interface StatusDetectionResult {
    status: CallStatus;
    confidence: number;
    reason: string;
}
/**
 * Detect call status using GPT-5-mini
 *
 * Status definitions:
 * - connected: Successfully reached decision maker, had meaningful conversation
 * - reception: Reached receptionist/gatekeeper, didn't reach decision maker
 * - no_conversation: No meaningful conversation (too short, voicemail, etc.)
 */
export declare function detectCallStatus(transcript: string, duration: number): Promise<StatusDetectionResult>;
//# sourceMappingURL=statusDetection.d.ts.map