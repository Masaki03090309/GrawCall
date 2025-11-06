import { CallStatus } from './statusDetection';
export interface SlackNotificationData {
    callId: string;
    callerNumber?: string;
    calledNumber?: string;
    callTime: Date;
    duration: number;
    status: CallStatus;
    transcriptUrl?: string;
    feedbackText?: string;
    webAppUrl?: string;
}
/**
 * Send Slack notification for call processing completion
 */
export declare function sendSlackNotification(webhookUrl: string, data: SlackNotificationData): Promise<void>;
//# sourceMappingURL=slackNotification.d.ts.map