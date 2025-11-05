import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
export async function GET() {
  try {
    const supabase = await createClient()

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

    // Get user details from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'ユーザー情報の取得に失敗しました',
            details: userError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: userData || {
        id: user.id,
        email: user.email,
        name: user.email?.split('@')[0] || 'User',
        role: 'user',
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
