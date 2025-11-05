import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/calls
 * Get list of calls (with RLS filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('project_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('calls')
      .select(
        `
        id,
        call_time,
        duration_seconds,
        caller_number,
        callee_number,
        status,
        status_confidence,
        feedback_text,
        user:users(id, name, email),
        project:projects(id, name)
      `,
        { count: 'exact' }
      )
      .order('call_time', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: calls, error: callsError, count } = await query

    if (callsError) {
      console.error('Error fetching calls:', callsError)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'データベースエラーが発生しました',
            details: callsError,
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        items: calls || [],
        total: count || 0,
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/calls:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
          details: error.message,
        },
      },
      { status: 500 }
    )
  }
}
