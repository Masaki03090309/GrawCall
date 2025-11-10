import axios from 'axios'
import { CallStatus } from './statusDetection'

export interface SlackNotificationData {
  callId: string
  callerNumber?: string
  calledNumber?: string
  callTime: Date
  duration: number
  status: CallStatus
  transcriptUrl?: string
  feedbackText?: string
  webAppUrl?: string
  projectName?: string
  userName?: string
}

/**
 * Send Slack notification for call processing completion
 */
export async function sendSlackNotification(
  webhookUrl: string,
  data: SlackNotificationData
): Promise<void> {
  if (!webhookUrl || webhookUrl === 'your-slack-webhook-url') {
    console.log('Slack webhook URL not configured, skipping notification')
    return
  }

  console.log(`Sending Slack notification for call ${data.callId}...`)

  try {
    // Determine call outcome status
    const callOutcome = determineCallOutcome(data)
    const feedbackUrl = `${data.webAppUrl}/calls/${data.callId}`

    // Format message according to user specifications
    let messageText = `【${data.projectName || 'プロジェクト名不明'}】\n`
    messageText += `架電者：${data.userName || '不明'}\n`
    messageText += `格納ファイル：${feedbackUrl}\n`
    messageText += `お客様電話番号：${data.calledNumber || 'N/A'}\n`
    messageText += `通話ステータス：${callOutcome}\n`

    if (data.feedbackText) {
      messageText += `\nフィードバック内容：\n〔架電結果〕\n${data.feedbackText}`
    }

    const payload = {
      text: messageText,
    }

    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    console.log('Slack notification sent successfully')
  } catch (error: any) {
    console.error('Error sending Slack notification:', error.message)
    // Don't throw error - notification failure shouldn't stop processing
  }
}

/**
 * Determine call outcome based on status only
 * Status is determined by GPT-5-nano status detection
 */
function determineCallOutcome(data: SlackNotificationData): string {
  switch (data.status) {
    case 'connected':
      return 'つながった'

    case 'reception':
      return '受付に当たっただけ'

    case 'no_conversation':
      return '会話なし'

    default:
      return 'つながった'
  }
}

function getStatusEmoji(status: CallStatus): string {
  switch (status) {
    case 'connected':
      return '✅'
    case 'reception':
      return '⚠️'
    case 'no_conversation':
      return '❌'
    default:
      return '❓'
  }
}

function getStatusText(status: CallStatus): string {
  switch (status) {
    case 'connected':
      return 'つながった（有意義な会話）'
    case 'reception':
      return '受付に当たっただけ'
    case 'no_conversation':
      return '会話なし'
    default:
      return '不明'
  }
}

function getStatusColor(status: CallStatus): string {
  switch (status) {
    case 'connected':
      return 'good' // Green
    case 'reception':
      return 'warning' // Yellow
    case 'no_conversation':
      return 'danger' // Red
    default:
      return '#808080' // Gray
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}
