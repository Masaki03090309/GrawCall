import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for update
const UpdateProjectSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(255).optional(),
  slack_webhook_url: z.string().url('有効なURLを入力してください').optional().nullable(),
})

/**
 * GET /api/projects/:id
 * Get a single project by ID
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

    const projectId = params.id

    // Fetch project with members
    // RLS will automatically check if user has access to this project
    const { data: project, error } = await supabase
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
      .eq('id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
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

      console.error('Error fetching project:', error)
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
      data: project,
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
 * PUT /api/projects/:id
 * Update a project
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

    const projectId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateProjectSchema.safeParse(body)

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
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role !== 'director') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロジェクトを更新する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Update project
    const { data: project, error: updateError } = await supabase
      .from('projects')
      .update(validationResult.data)
      .eq('id', projectId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating project:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロジェクトの更新に失敗しました',
            details: updateError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: project,
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
 * DELETE /api/projects/:id
 * Delete a project
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

    const projectId = params.id

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
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role !== 'director') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロジェクトを削除する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Delete project (cascade will handle project_members, calls, etc.)
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId)

    if (deleteError) {
      console.error('Error deleting project:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'プロジェクトの削除に失敗しました',
            details: deleteError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'プロジェクトが削除されました',
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
