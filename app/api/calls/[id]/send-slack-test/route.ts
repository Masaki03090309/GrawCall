import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/calls/[id]/send-slack-test
 * Manual Slack notification test for a specific call
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const callId = params.id

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        },
        { status: 401 }
      )
    }

    // Get call details
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select(
        `
        id,
        call_time,
        duration_seconds,
        caller_number,
        callee_number,
        status,
        feedback_text,
        project_id,
        user_id,
        user:users!calls_user_id_fkey(id, name, email)
      `
      )
      .eq('id', callId)
      .single()

    if (callError || !call) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CALL_NOT_FOUND',
            message: '通話が見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Get project details
    if (!call.project_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_PROJECT',
            message: 'この通話はプロジェクトに紐付いていません',
          },
        },
        { status: 400 }
      )
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, slack_webhook_url')
      .eq('id', call.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'プロジェクトが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    if (!project.slack_webhook_url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WEBHOOK_NOT_CONFIGURED',
            message: 'プロジェクトにSlack WebhookURLが設定されていません',
          },
        },
        { status: 400 }
      )
    }

    // Determine call outcome
    let callOutcome = 'つながっただけ'
    if (call.feedback_text) {
      const lowerFeedback = call.feedback_text.toLowerCase()
      if (
        lowerFeedback.includes('アポ') ||
        lowerFeedback.includes('約束') ||
        lowerFeedback.includes('面談') ||
        lowerFeedback.includes('訪問') ||
        lowerFeedback.includes('次回') ||
        lowerFeedback.includes('日程')
      ) {
        callOutcome = 'アポイント獲得'
      }
    }

    // Build Slack message
    const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7000'
    const feedbackUrl = `${webAppUrl}/calls/${call.id}`

    let messageText = `【${project.name}】\n`
    messageText += `架電者：${(call.user as any)?.name || '不明'}\n`
    messageText += `格納ファイル：${feedbackUrl}\n`
    messageText += `お客様電話番号：${call.callee_number || 'N/A'}\n`
    messageText += `通話ステータス：${callOutcome}\n`

    if (call.feedback_text) {
      messageText += `\nフィードバック内容：\n〔架電結果〕\n${call.feedback_text}`
    }

    // Send to Slack
    const slackResponse = await fetch(project.slack_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: messageText }),
    })

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text()
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SLACK_API_ERROR',
            message: 'Slackへの送信に失敗しました',
            details: errorText,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Slackにテスト通知を送信しました',
        project_name: project.name,
        call_outcome: callOutcome,
        preview: messageText,
      },
    })
  } catch (error: any) {
    console.error('Unexpected error in send-slack-test:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
          details: error.message,
        },
      },
      { status: 500 }
    )
  }
}
