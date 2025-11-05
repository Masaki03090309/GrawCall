import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/prompts/:id/history
 * Get prompt change history (last 10 versions)
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

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

    const promptId = params.id

    // Get the prompt to determine project_id and prompt_type
    const { data: currentPrompt, error: currentError } = await supabase
      .from('prompts')
      .select('project_id, prompt_type')
      .eq('id', promptId)
      .single()

    if (currentError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'プロンプトが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Get all versions for this project and prompt_type (last 10)
    const { data: history, error: historyError } = await supabase
      .from('prompts')
      .select('*, created_by_user:users!created_by(id, name, email)')
      .eq('project_id', currentPrompt.project_id)
      .eq('prompt_type', currentPrompt.prompt_type)
      .order('version', { ascending: false })
      .limit(10)

    if (historyError) {
      console.error('Error fetching prompt history:', historyError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプト履歴の取得に失敗しました',
            details: historyError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        history,
        total: history.length,
      },
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
        },
      },
      { status: 500 }
    )
  }
}
