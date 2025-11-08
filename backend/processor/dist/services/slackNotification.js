"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSlackNotification = sendSlackNotification;
const axios_1 = __importDefault(require("axios"));
/**
 * Send Slack notification for call processing completion
 */
async function sendSlackNotification(webhookUrl, data) {
    if (!webhookUrl || webhookUrl === 'your-slack-webhook-url') {
        console.log('Slack webhook URL not configured, skipping notification');
        return;
    }
    console.log(`Sending Slack notification for call ${data.callId}...`);
    try {
        // Determine call outcome status
        const callOutcome = determineCallOutcome(data);
        const feedbackUrl = `${data.webAppUrl}/calls/${data.callId}`;
        // Format message according to user specifications
        let messageText = `【${data.projectName || 'プロジェクト名不明'}】\n`;
        messageText += `架電者：${data.userName || '不明'}\n`;
        messageText += `格納ファイル：${feedbackUrl}\n`;
        messageText += `お客様電話番号：${data.calledNumber || 'N/A'}\n`;
        messageText += `通話ステータス：${callOutcome}\n`;
        if (data.feedbackText) {
            messageText += `\nフィードバック内容：\n〔架電結果〕\n${data.feedbackText}`;
        }
        const payload = {
            text: messageText,
        };
        await axios_1.default.post(webhookUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
        console.log('Slack notification sent successfully');
    }
    catch (error) {
        console.error('Error sending Slack notification:', error.message);
        // Don't throw error - notification failure shouldn't stop processing
    }
}
/**
 * Determine call outcome based on feedback content and duration
 */
function determineCallOutcome(data) {
    // If there's feedback text with meaningful content, check for appointment indicators
    if (data.feedbackText) {
        const lowerFeedback = data.feedbackText.toLowerCase();
        // Check for appointment-related keywords
        if (lowerFeedback.includes('アポ') ||
            lowerFeedback.includes('約束') ||
            lowerFeedback.includes('面談') ||
            lowerFeedback.includes('訪問') ||
            lowerFeedback.includes('次回') ||
            lowerFeedback.includes('日程')) {
            return 'アポイント獲得';
        }
        // If feedback exists but no appointment indicators, it's just connected
        return 'つながっただけ';
    }
    // No feedback means just connected
    return 'つながっただけ';
}
function getStatusEmoji(status) {
    switch (status) {
        case 'connected':
            return '✅';
        case 'reception':
            return '⚠️';
        case 'no_conversation':
            return '❌';
        default:
            return '❓';
    }
}
function getStatusText(status) {
    switch (status) {
        case 'connected':
            return 'つながった（有意義な会話）';
        case 'reception':
            return '受付に当たっただけ';
        case 'no_conversation':
            return '会話なし';
        default:
            return '不明';
    }
}
function getStatusColor(status) {
    switch (status) {
        case 'connected':
            return 'good'; // Green
        case 'reception':
            return 'warning'; // Yellow
        case 'no_conversation':
            return 'danger'; // Red
        default:
            return '#808080'; // Gray
    }
}
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}
//# sourceMappingURL=slackNotification.js.map