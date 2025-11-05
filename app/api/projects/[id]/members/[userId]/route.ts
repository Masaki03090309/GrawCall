import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove a member from a project
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; userId: string } }
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

    const projectId = params.id
    const userIdToRemove = params.userId

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
              message: 'メンバーを削除する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Verify the member exists in the project
    const { data: existingMember, error: checkError } = await supabase
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', projectId)
      .eq('user_id', userIdToRemove)
      .single()

    if (checkError || !existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'メンバーが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Check if this is the last director - prevent removal if so
    if (existingMember.role === 'director') {
      const { data: directorCount } = await supabase
        .from('project_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('role', 'director')

      if (directorCount && (directorCount as any).count === 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'LAST_DIRECTOR',
              message: '最後のディレクターは削除できません',
            },
          },
          { status: 409 }
        )
      }
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userIdToRemove)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'メンバーの削除に失敗しました',
            details: deleteError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'メンバーが削除されました',
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
