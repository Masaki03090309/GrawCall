import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const RestoreVersionSchema = z.object({
  version_id: z.string().uuid('有効なバージョンIDを入力してください'),
})

/**
 * POST /api/admin/default-prompts/:id/restore
 * Restore a previous version of system default prompt (owner only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
            message: 'デフォルトプロンプトの復元にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    const promptId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = RestoreVersionSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: validationResult.error.flatten(),
          },
        },
        { status: 422 }
      )
    }

    const { version_id } = validationResult.data

    // Verify prompt exists and is system default
    const { data: currentPrompt } = await supabase
      .from('prompts')
      .select('id, project_id')
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

    // Fetch the version to restore
    const { data: versionToRestore, error: versionError } = await supabase
      .from('prompt_versions')
      .select('content, version')
      .eq('id', version_id)
      .eq('prompt_id', promptId)
      .single()

    if (versionError || !versionToRestore) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定されたバージョンが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Restore by updating current prompt with old content
    // The trigger will automatically create a new version
    const { data: restoredPrompt, error: restoreError } = await supabase
      .from('prompts')
      .update({
        content: versionToRestore.content,
        change_comment: `バージョン ${versionToRestore.version} を復元`,
      })
      .eq('id', promptId)
      .select(
        `
        id,
        prompt_type,
        content,
        version,
        is_active,
        change_comment,
        created_at,
        created_by,
        users:created_by(id, name, email)
      `
      )
      .single()

    if (restoreError) {
      console.error('Error restoring prompt version:', restoreError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプトバージョンの復元に失敗しました',
            details: restoreError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: restoredPrompt,
      message: `バージョン ${versionToRestore.version} を復元しました`,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: error.flatten(),
          },
        },
        { status: 422 }
      )
    }

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
