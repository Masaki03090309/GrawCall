import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const CreatePromptSchema = z.object({
  project_id: z.string().uuid('有効なプロジェクトIDを入力してください'),
  prompt_type: z.enum(['connected', 'reception'], {
    errorMap: () => ({
      message: 'プロンプトタイプは connected または reception である必要があります',
    }),
  }),
  content: z.string().min(1, 'プロンプト内容は必須です'),
  change_comment: z.string().optional(),
  is_active: z.boolean().optional().default(true),
})

/**
 * GET /api/prompts
 * Get all prompts for a project (with optional filtering)
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const promptType = searchParams.get('prompt_type')

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'project_id パラメータは必須です',
          },
        },
        { status: 422 }
      )
    }

    // Verify user has access to this project (via RLS or manual check)
    const { data: _project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'プロジェクトが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('prompts')
      .select('*, created_by_user:users!created_by(id, name, email)')
      .eq('project_id', projectId)
      .order('version', { ascending: false })

    if (promptType) {
      query = query.eq('prompt_type', promptType)
    }

    const { data: prompts, error } = await query

    if (error) {
      console.error('Error fetching prompts:', error)
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
 * POST /api/prompts
 * Create a new prompt (automatically increments version)
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CreatePromptSchema.safeParse(body)

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

    const { project_id, prompt_type, content, change_comment, is_active } = validationResult.data

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
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role !== 'director') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロンプトを作成する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Get the latest version for this project and prompt_type
    const { data: latestPrompt } = await supabase
      .from('prompts')
      .select('version')
      .eq('project_id', project_id)
      .eq('prompt_type', prompt_type)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newVersion = latestPrompt ? latestPrompt.version + 1 : 1

    // If is_active is true, deactivate all other prompts of this prompt_type
    if (is_active) {
      await supabase
        .from('prompts')
        .update({ is_active: false })
        .eq('project_id', project_id)
        .eq('prompt_type', prompt_type)
    }

    // Create new prompt
    const { data: prompt, error: createError } = await supabase
      .from('prompts')
      .insert({
        project_id,
        prompt_type,
        version: newVersion,
        content,
        change_comment,
        is_active,
        created_by: user.id,
      })
      .select('*, created_by_user:users!created_by(id, name, email)')
      .single()

    if (createError) {
      console.error('Error creating prompt:', createError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロンプトの作成に失敗しました',
            details: createError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: prompt,
      },
      { status: 201 }
    )
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
