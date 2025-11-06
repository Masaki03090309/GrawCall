import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/talk-scripts/:id/history
 * Get version history for a talk script (last 10 versions)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Get current talk script to find project_id
    const { data: currentTalkScript, error: fetchError } = await supabase
      .from('talk_scripts')
      .select('project_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Talk script not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch talk script' },
        { status: 500 }
      )
    }

    // Get version history (last 10 versions)
    const { data: history, error: historyError } = await supabase
      .from('talk_scripts')
      .select(
        `
        id,
        version,
        opening_script,
        proposal_script,
        closing_script,
        change_comment,
        is_active,
        created_at,
        created_by:users!talk_scripts_created_by_fkey(id, name),
        hearing_items:talk_script_hearing_items(*)
      `
      )
      .eq('project_id', currentTalkScript.project_id)
      .order('version', { ascending: false })
      .limit(10)

    if (historyError) {
      console.error('Error fetching talk script history:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      )
    }

    // Format history data
    const formattedHistory = history.map((version, index) => {
      // Sort hearing items
      const sortedHearingItems = (version.hearing_items || []).sort(
        (a, b) => a.display_order - b.display_order
      )

      // Calculate diff if not the first version
      let diff = null
      if (index < history.length - 1) {
        const previousVersion = history[index + 1]
        diff = {
          opening_changed: version.opening_script !== previousVersion.opening_script,
          proposal_changed: version.proposal_script !== previousVersion.proposal_script,
          closing_changed: version.closing_script !== previousVersion.closing_script,
          hearing_items_changed: JSON.stringify(version.hearing_items) !== JSON.stringify(previousVersion.hearing_items),
        }
      }

      return {
        id: version.id,
        version: version.version,
        opening_script: version.opening_script,
        proposal_script: version.proposal_script,
        closing_script: version.closing_script,
        hearing_items: sortedHearingItems,
        change_comment: version.change_comment,
        is_active: version.is_active,
        created_by: version.created_by,
        created_at: version.created_at,
        diff,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        history: formattedHistory,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/talk-scripts/:id/history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
