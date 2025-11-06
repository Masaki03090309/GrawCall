import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const CreateDefaultPromptSchema = z.object({
  prompt_type: z.enum(['connected', 'reception']),
  content: z.string().min(1, 'プロンプト内容を入力してください'),
  change_comment: z.string().optional(),
})

/**
 * GET /api/admin/default-prompts
 * Get system default prompts (owner only)
 */
export async function GET(_request: NextRequest) {
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

    // Fetch system default prompts (project_id = NULL)
    const { data: prompts, error } = await supabase
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
      .is('project_id', null)
      .eq('is_active', true)
      .order('prompt_type', { ascending: true })

    if (error) {
      console.error('Error fetching default prompts:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'デフォルトプロンプトの取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        items: prompts,
        total: prompts.length,
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

/**
 * POST /api/admin/default-prompts
 * Create or update system default prompt (owner only)
 */
export async function POST(request: NextRequest) {
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
            message: 'システムデフォルトプロンプトの作成にはオーナー権限が必要です',
          },
        },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CreateDefaultPromptSchema.safeParse(body)

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

    const { prompt_type, content, change_comment } = validationResult.data

    // Check if system default prompt already exists for this type
    const { data: existingPrompt } = await supabase
      .from('prompts')
      .select('id')
      .is('project_id', null)
      .eq('prompt_type', prompt_type)
      .eq('is_active', true)
      .single()

    if (existingPrompt) {
      // Update existing prompt (creates new version via trigger)
      const { data: updatedPrompt, error: updateError } = await supabase
        .from('prompts')
        .update({
          content,
          change_comment,
        })
        .eq('id', existingPrompt.id)
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
        message: 'デフォルトプロンプトを更新しました',
      })
    } else {
      // Create new system default prompt
      const { data: newPrompt, error: createError } = await supabase
        .from('prompts')
        .insert({
          project_id: null,
          prompt_type,
          content,
          is_active: true,
          created_by: user.id,
          change_comment,
        })
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

      if (createError) {
        console.error('Error creating default prompt:', createError)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'デフォルトプロンプトの作成に失敗しました',
              details: createError,
            },
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          data: newPrompt,
          message: 'デフォルトプロンプトを作成しました',
        },
        { status: 201 }
      )
    }
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
