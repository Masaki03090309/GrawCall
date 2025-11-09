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

    // If project_id is specified, get project members' Zoom IDs and filter calls
    let memberZoomUserIds: string[] = []
    if (projectId) {
      const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('user_id, users(zoom_user_id)')
        .eq('project_id', projectId)

      if (membersError) {
        console.error('Error fetching project members:', membersError)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'プロジェクトメンバーの取得に失敗しました',
              details: membersError,
            },
          },
          { status: 500 }
        )
      }

      // Extract Zoom User IDs from members
      memberZoomUserIds =
        members?.map(m => (m.users as any)?.zoom_user_id).filter(zoomId => zoomId != null) || []

      // If no members have Zoom IDs, return empty list
      if (memberZoomUserIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            items: [],
            total: 0,
            limit,
            offset,
          },
        })
      }
    }

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
        zoom_user_id,
        user:users!calls_user_id_fkey(id, name, email),
        project:projects(id, name)
      `,
        { count: 'exact' }
      )
      .order('call_time', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (projectId && memberZoomUserIds.length > 0) {
      // Filter by Zoom User IDs of project members (dynamic lookup)
      query = query.in('zoom_user_id', memberZoomUserIds)
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

    // Dynamically lookup current user for each call based on zoom_user_id
    // This allows user display to change when zoom_user_id assignment changes
    const enrichedCalls = await Promise.all(
      (calls || []).map(async (call: any) => {
        if (call.zoom_user_id) {
          const { data: currentUser } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('zoom_user_id', call.zoom_user_id)
            .maybeSingle()

          return {
            ...call,
            user: currentUser || call.user, // Use current user or fallback to stored user_id
          }
        }
        return call
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        items: enrichedCalls,
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
