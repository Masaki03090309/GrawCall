import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const CreateProjectSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255),
  slack_webhook_url: z.string().url('有効なURLを入力してください').optional().nullable(),
})

/**
 * GET /api/projects
 * Get all projects accessible by the current user
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

    // RLS will automatically filter projects based on user's access
    // - Owners can see all projects
    // - Directors can see projects they're members of
    // - Users can see projects they're members of
    const { data: projects, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        project_members(
          user_id,
          role,
          users(id, name, email, role)
        )
      `
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロジェクトの取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        items: projects,
        total: projects.length,
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
 * POST /api/projects
 * Create a new project
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
    const validationResult = CreateProjectSchema.safeParse(body)

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

    const { name, slack_webhook_url } = validationResult.data

    // Check user role - only owners and directors can create projects
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

    if (userData.role !== 'owner' && userData.role !== 'director') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'プロジェクトを作成する権限がありません',
          },
        },
        { status: 403 }
      )
    }

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        name,
        slack_webhook_url,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating project:', createError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロジェクトの作成に失敗しました',
            details: createError,
          },
        },
        { status: 500 }
      )
    }

    // Add creator as a director member
    const { error: memberError } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      role: 'director',
    })

    if (memberError) {
      console.error('Error adding creator as member:', memberError)
      // Project was created but member assignment failed
      // We should still return success but log the error
    }

    return NextResponse.json(
      {
        success: true,
        data: project,
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
