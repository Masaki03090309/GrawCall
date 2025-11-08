import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/projects/[id]/test-webhook
 * Test Slack webhook for a project
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const projectId = params.id

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

    // Get user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'ユーザー情報が見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Check if user has access to this project (owner or project member)
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'このプロジェクトにアクセスする権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Get project with webhook URL
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, slack_webhook_url')
      .eq('id', projectId)
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
            message: 'Slack WebhookURLが設定されていません',
          },
        },
        { status: 400 }
      )
    }

    // Send test message to Slack
    const testMessage = {
      text: `🔔 *テスト通知*\n\nプロジェクト「${project.name}」のSlack Webhook接続テストです。\n\nこのメッセージが表示されていれば、Webhookは正しく設定されています。`,
    }

    const slackResponse = await fetch(project.slack_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
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
        message: 'テストメッセージを送信しました',
      },
    })
  } catch (error: any) {
    console.error('Unexpected error in test-webhook:', error)

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
