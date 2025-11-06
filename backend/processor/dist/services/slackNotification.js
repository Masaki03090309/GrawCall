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
        const statusEmoji = getStatusEmoji(data.status);
        const statusText = getStatusText(data.status);
        const color = getStatusColor(data.status);
        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${statusEmoji} 通話処理完了`,
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*ステータス:*\n${statusText}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*通話時間:*\n${data.duration}秒`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*発信者番号:*\n${data.callerNumber || 'N/A'}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*着信番号:*\n${data.calledNumber || 'N/A'}`,
                    },
                ],
            },
        ];
        // Add feedback if available and status is connected
        if (data.feedbackText && data.status === 'connected') {
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*フィードバック:*\n${truncateText(data.feedbackText, 500)}`,
                },
            });
        }
        // Add action button
        if (data.webAppUrl) {
            blocks.push({
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '詳細を見る',
                            emoji: true,
                        },
                        url: `${data.webAppUrl}/calls/${data.callId}`,
                        style: 'primary',
                    },
                ],
            });
        }
        const payload = {
            attachments: [
                {
                    color: color,
                    blocks: blocks,
                    footer: `Call ID: ${data.callId}`,
                    ts: Math.floor(data.callTime.getTime() / 1000).toString(),
                },
            ],
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