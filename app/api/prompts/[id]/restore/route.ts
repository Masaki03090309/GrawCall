import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * POST /api/prompts/:id/restore
 * Restore a specific version of a prompt
 *
 * This creates a new version based on the selected historical version
 */

const RestorePromptSchema = z.object({
  version: z.number().int().positive(),
  change_comment: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    const body = await request.json()
    const validated = RestorePromptSchema.parse(body)

    const promptId = params.id

    // Get the current prompt to determine project_id and prompt_type
    const { data: currentPrompt, error: currentError } = await supabase
      .from('prompts')
      .select('project_id, prompt_type, version')
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

    // Check user role (only owner or director can restore)
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', currentPrompt.project_id)
      .eq('user_id', user.id)
      .single()

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isOwner = userProfile?.role === 'owner'
    const isDirectorOrOwner = isOwner || member?.role === 'director' || member?.role === 'owner'

    if (!isDirectorOrOwner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'プロンプトを復元する権限がありません',
          },
        },
        { status: 403 }
      )
    }

    // Get the version to restore
    const { data: versionToRestore, error: versionError } = await supabase
      .from('prompts')
      .select('*')
      .eq('project_id', currentPrompt.project_id)
      .eq('prompt_type', currentPrompt.prompt_type)
      .eq('version', validated.version)
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

    // Deactivate current active version
    const { error: deactivateError } = await supabase
      .from('prompts')
      .update({ is_active: false })
      .eq('project_id', currentPrompt.project_id)
      .eq('prompt_type', currentPrompt.prompt_type)
      .eq('is_active', true)

    if (deactivateError) {
      console.error('Error deactivating current version:', deactivateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '現在のバージョンの無効化に失敗しました',
          },
        },
        { status: 500 }
      )
    }

    // Create new version based on the restored version
    const newVersion = currentPrompt.version + 1
    const changeComment = validated.change_comment || `バージョン ${validated.version} から復元`

    const { data: newPrompt, error: insertError } = await supabase
      .from('prompts')
      .insert({
        project_id: versionToRestore.project_id,
        prompt_type: versionToRestore.prompt_type,
        prompt_content: versionToRestore.prompt_content,
        version: newVersion,
        is_active: true,
        created_by: user.id,
        change_comment: changeComment,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating restored version:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '復元バージョンの作成に失敗しました',
            details: insertError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        prompt: newPrompt,
        message: `バージョン ${validated.version} を新しいバージョン ${newVersion} として復元しました`,
      },
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '入力データが不正です',
            details: error.errors,
          },
        },
        { status: 422 }
      )
    }

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
