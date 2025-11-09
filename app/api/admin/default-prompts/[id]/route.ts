import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const UpdateDefaultPromptSchema = z.object({
  content: z.string().min(1, 'プロンプト内容を入力してください'),
  change_comment: z.string().optional(),
})

/**
 * GET /api/admin/default-prompts/:id
 * Get a specific system default prompt (owner only)
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
            message: 'システムデフォルトプロンプトの閲覧にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    const promptId = params.id

    // Fetch system default prompt
    const { data: prompt, error } = await supabase
      .from('prompts')
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
      .eq('id', promptId)
      .is('project_id', null)
      .single()

    if (error || !prompt) {
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

    return NextResponse.json({
      success: true,
      data: prompt,
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

/**
 * PUT /api/admin/default-prompts/:id
 * Update a system default prompt (owner only)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
            message: 'システムデフォルトプロンプトの更新にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    const promptId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateDefaultPromptSchema.safeParse(body)

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

    const { content, change_comment } = validationResult.data

    // Verify prompt exists and is system default
    const { data: existingPrompt } = await supabase
      .from('prompts')
      .select('id, project_id')
      .eq('id', promptId)
      .single()

    if (!existingPrompt || existingPrompt.project_id !== null) {
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

    // Update prompt (trigger will create new version)
    const { data: updatedPrompt, error: updateError } = await supabase
      .from('prompts')
      .update({
        content,
        change_comment,
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

    if (updateError) {
      console.error('Error updating default prompt:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'デフォルトプロンプトの更新に失敗しました',
            details: updateError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedPrompt,
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

/**
 * DELETE /api/admin/default-prompts/:id
 * Delete a system default prompt (owner only)
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
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
            message: 'システムデフォルトプロンプトの削除にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    const promptId = params.id

    // Verify prompt exists and is system default
    const { data: existingPrompt } = await supabase
      .from('prompts')
      .select('id, project_id')
      .eq('id', promptId)
      .single()

    if (!existingPrompt || existingPrompt.project_id !== null) {
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

    // Delete prompt
    const { error: deleteError } = await supabase.from('prompts').delete().eq('id', promptId)

    if (deleteError) {
      console.error('Error deleting default prompt:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'デフォルトプロンプトの削除に失敗しました',
            details: deleteError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'デフォルトプロンプトを削除しました',
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
