import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for adding member
const AddMemberSchema = z.object({
  user_id: z.string().uuid('有効なユーザーIDを入力してください'),
  role: z.enum(['director', 'user'], {
    errorMap: () => ({ message: 'ロールは director または user である必要があります' }),
  }),
})

/**
 * GET /api/projects/:id/members
 * Get all members of a project
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

    // Verify user has access to this project
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

    // Fetch all members with user information
    const { data: members, error } = await supabase
      .from('project_members')
      .select(
        `
        user_id,
        role,
        created_at,
        users(id, name, email, role)
      `
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'メンバーの取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        items: members,
        total: members.length,
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
 * POST /api/projects/:id/members
 * Add a member to a project
 */
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

    const projectId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = AddMemberSchema.safeParse(body)

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

    const { user_id, role } = validationResult.data

    // Check if authenticated user has director role in this project or is owner
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
              message: 'メンバーを追加する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Verify the user to be added exists in users table
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .maybeSingle()

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '追加するユーザーが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', user_id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_MEMBER',
            message: 'このユーザーは既にプロジェクトのメンバーです',
          },
        },
        { status: 409 }
      )
    }

    // Add member
    const { data: member, error: addError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id,
        role,
      })
      .select(
        `
        user_id,
        role,
        created_at,
        users(id, name, email, role)
      `
      )
      .single()

    if (addError) {
      console.error('Error adding member:', addError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'メンバーの追加に失敗しました',
            details: addError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: member,
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
