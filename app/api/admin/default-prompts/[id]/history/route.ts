import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/default-prompts/:id/history
 * Get version history of a system default prompt (owner only)
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

    // Check if user is owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'デフォルトプロンプト履歴の閲覧にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    const promptId = params.id

    // Verify prompt exists and is system default
    const { data: currentPrompt } = await supabase
      .from('prompts')
      .select('id, project_id, prompt_type')
      .eq('id', promptId)
      .single()

    if (!currentPrompt || currentPrompt.project_id !== null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'デフォルトプロンプトが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Fetch version history from prompt_versions table
    const { data: versions, error } = await supabase
      .from('prompt_versions')
      .select(
        `
        id,
        prompt_id,
        content,
        version,
        change_comment,
        created_by,
        created_at,
        users:created_by(id, name, email)
      `
      )
      .eq('prompt_id', promptId)
      .order('version', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching prompt history:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプト履歴の取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        current_prompt_id: promptId,
        prompt_type: currentPrompt.prompt_type,
        versions: versions || [],
        total: versions?.length || 0,
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
