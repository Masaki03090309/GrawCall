import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for update
const UpdatePromptSchema = z.object({
  content: z.string().min(1, 'プロンプト内容は必須です').optional(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/prompts/:id
 * Get a single prompt by ID
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

    // Fetch prompt
    const { data: prompt, error } = await supabase
      .from('prompts')
      .select('*, created_by_user:users!created_by(id, name, email)')
      .eq('id', promptId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
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

      console.error('Error fetching prompt:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプトの取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
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
 * PUT /api/prompts/:id
 * Update a prompt (can only update content or is_active)
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

    const promptId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdatePromptSchema.safeParse(body)

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

    // Get the prompt to check permissions
    const { data: existingPrompt, error: fetchError } = await supabase
      .from('prompts')
      .select('project_id, prompt_type')
      .eq('id', promptId)
      .single()

    if (fetchError) {
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

    // Check if user has director role in this project or is owner
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

    // If not owner, check if user is a director in this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', existingPrompt.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role !== 'director') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロンプトを更新する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // If is_active is being set to true, deactivate all other prompts of this prompt_type
    if (validationResult.data.is_active === true) {
      await supabase
        .from('prompts')
        .update({ is_active: false })
        .eq('project_id', existingPrompt.project_id)
        .eq('prompt_type', existingPrompt.prompt_type)
        .neq('id', promptId)
    }

    // Update prompt
    const { data: prompt, error: updateError } = await supabase
      .from('prompts')
      .update(validationResult.data)
      .eq('id', promptId)
      .select('*, created_by_user:users!created_by(id, name, email)')
      .single()

    if (updateError) {
      console.error('Error updating prompt:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプトの更新に失敗しました',
            details: updateError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: prompt,
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
 * DELETE /api/prompts/:id
 * Delete a prompt (soft delete by setting is_active to false)
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

    const promptId = params.id

    // Get the prompt to check permissions
    const { data: existingPrompt, error: fetchError } = await supabase
      .from('prompts')
      .select('project_id')
      .eq('id', promptId)
      .single()

    if (fetchError) {
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

    // Check if user has director role in this project or is owner
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

    // If not owner, check if user is a director in this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', existingPrompt.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role !== 'director') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロンプトを削除する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Delete prompt (actual delete, not soft delete)
    const { error: deleteError } = await supabase.from('prompts').delete().eq('id', promptId)

    if (deleteError) {
      console.error('Error deleting prompt:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプトの削除に失敗しました',
            details: deleteError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'プロンプトが削除されました',
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
