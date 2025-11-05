import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for updating user
const UpdateUserSchema = z
  .object({
    role: z
      .enum(['owner', 'director', 'user'], {
        errorMap: () => ({
          message: 'ロールは owner, director, または user である必要があります',
        }),
      })
      .optional(),
    zoom_user_id: z.string().nullable().optional(),
  })
  .refine(data => data.role !== undefined || data.zoom_user_id !== undefined, {
    message: 'role または zoom_user_id のいずれかを指定してください',
  })

/**
 * GET /api/users/:id
 * Get a single user by ID
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

    const userId = params.id

    // Users can only view their own profile unless they are owner
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentUserError || !currentUserData) {
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

    if (currentUserData.role !== 'owner' && user.id !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '他のユーザー情報を取得する権限がありません',
          },
        },
        { status: 403 }
      )
    }

    // Fetch user
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'ユーザーが見つかりません',
            },
          },
          { status: 404 }
        )
      }

      console.error('Error fetching user:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'ユーザーの取得に失敗しました',
            details: error,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: userData,
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
 * PUT /api/users/:id
 * Update user role (owner only) or zoom_user_id (owner or self)
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

    const userId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateUserSchema.safeParse(body)

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

    // Get current user role
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentUserError || !currentUserData) {
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

    const isOwner = currentUserData.role === 'owner'
    const isSelf = user.id === userId

    // Permission checks
    if (validationResult.data.role !== undefined) {
      // Only owners can update user roles
      if (!isOwner) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'ユーザーロールを更新する権限がありません',
            },
          },
          { status: 403 }
        )
      }

      // Prevent owner from changing their own role
      if (isSelf && validationResult.data.role !== 'owner') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: '自分のオーナーロールは変更できません',
            },
          },
          { status: 403 }
        )
      }
    }

    if (validationResult.data.zoom_user_id !== undefined) {
      // Only owners or self can update zoom_user_id
      if (!isOwner && !isSelf) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Zoom User IDを更新する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Build update object
    const updateData: any = {}
    if (validationResult.data.role !== undefined) {
      updateData.role = validationResult.data.role
    }
    if (validationResult.data.zoom_user_id !== undefined) {
      updateData.zoom_user_id = validationResult.data.zoom_user_id
    }

    // Update user
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, email, role, zoom_user_id, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'ユーザー情報の更新に失敗しました',
            details: updateError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
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
