import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const HearingItemSchema = z.object({
  item_name: z.string().min(1).max(255),
  item_script: z.string().min(1),
  is_default: z.boolean().default(false),
  display_order: z.number().int().min(1),
})

const UpdateTalkScriptSchema = z.object({
  opening_script: z.string().optional(),
  proposal_script: z.string().optional(),
  closing_script: z.string().optional(),
  hearing_items: z.array(HearingItemSchema).max(10).optional(),
  change_comment: z.string().optional(),
})

/**
 * GET /api/talk-scripts/:id
 * Get specific talk script version by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get talk script with hearing items
    const { data: talkScript, error: talkScriptError } = await supabase
      .from('talk_scripts')
      .select(
        `
        *,
        created_by:users!talk_scripts_created_by_fkey(id, name),
        hearing_items:talk_script_hearing_items(*)
      `
      )
      .eq('id', id)
      .single()

    if (talkScriptError) {
      if (talkScriptError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Talk script not found' }, { status: 404 })
      }
      console.error('Error fetching talk script:', talkScriptError)
      return NextResponse.json({ error: 'Failed to fetch talk script' }, { status: 500 })
    }

    // Sort hearing items by display_order
    const sortedHearingItems = (talkScript.hearing_items || []).sort(
      (a: any, b: any) => a.display_order - b.display_order
    )

    return NextResponse.json({
      success: true,
      data: {
        id: talkScript.id,
        project_id: talkScript.project_id,
        version: talkScript.version,
        opening_script: talkScript.opening_script,
        proposal_script: talkScript.proposal_script,
        closing_script: talkScript.closing_script,
        hearing_items: sortedHearingItems,
        created_by: talkScript.created_by,
        change_comment: talkScript.change_comment,
        is_active: talkScript.is_active,
        created_at: talkScript.created_at,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/talk-scripts/:id:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/talk-scripts/:id
 * Update talk script (creates new version)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get current talk script
    const { data: currentTalkScript, error: fetchError } = await supabase
      .from('talk_scripts')
      .select('project_id, version')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Talk script not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch talk script' }, { status: 500 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = UpdateTalkScriptSchema.parse(body)

    // Check user role (owner or director)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    // Check if user is owner or director of this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', currentTalkScript.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only owners and directors can update talk scripts.' },
          { status: 403 }
        )
      }
    }

    // Deactivate all previous versions
    const { error: deactivateError } = await supabase
      .from('talk_scripts')
      .update({ is_active: false })
      .eq('project_id', currentTalkScript.project_id)
      .eq('is_active', true)

    if (deactivateError) {
      console.error('Error deactivating previous versions:', deactivateError)
      return NextResponse.json({ error: 'Failed to deactivate previous versions' }, { status: 500 })
    }

    // Get next version number
    const { data: latestVersion, error: versionError } = await supabase
      .from('talk_scripts')
      .select('version')
      .eq('project_id', currentTalkScript.project_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1

    // Insert new version
    const { data: newTalkScript, error: insertError } = await supabase
      .from('talk_scripts')
      .insert({
        project_id: currentTalkScript.project_id,
        version: nextVersion,
        opening_script: validated.opening_script || null,
        proposal_script: validated.proposal_script || null,
        closing_script: validated.closing_script || null,
        created_by: user.id,
        change_comment: validated.change_comment || 'Updated',
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting new talk script version:', insertError)
      return NextResponse.json({ error: 'Failed to create new version' }, { status: 500 })
    }

    // Insert hearing items if provided
    if (validated.hearing_items && validated.hearing_items.length > 0) {
      const hearingItemsToInsert = validated.hearing_items.map(item => ({
        talk_script_id: newTalkScript.id,
        item_name: item.item_name,
        item_script: item.item_script,
        is_default: item.is_default,
        display_order: item.display_order,
      }))

      const { error: hearingItemsError } = await supabase
        .from('talk_script_hearing_items')
        .insert(hearingItemsToInsert)

      if (hearingItemsError) {
        console.error('Error inserting hearing items:', hearingItemsError)
        // Rollback new version
        await supabase.from('talk_scripts').delete().eq('id', newTalkScript.id)
        // Re-activate previous version
        await supabase.from('talk_scripts').update({ is_active: true }).eq('id', id)
        return NextResponse.json({ error: 'Failed to create hearing items' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newTalkScript.id,
        version: newTalkScript.version,
        created_at: newTalkScript.created_at,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 422 }
      )
    }

    console.error('Error in PUT /api/talk-scripts/:id:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/talk-scripts/:id
 * Delete talk script (only if not used in any calls)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get talk script
    const { data: talkScript, error: fetchError } = await supabase
      .from('talk_scripts')
      .select('project_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Talk script not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch talk script' }, { status: 500 })
    }

    // Check user role (owner or director)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    // Check if user is owner or director of this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', talkScript.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only owners and directors can delete talk scripts.' },
          { status: 403 }
        )
      }
    }

    // Check if talk script is used in any calls
    const { data: callsCount, error: callsError } = await supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('talk_script_version_id', id)

    if (callsError) {
      console.error('Error checking calls:', callsError)
      return NextResponse.json(
        { error: 'Failed to check if talk script is in use' },
        { status: 500 }
      )
    }

    if (callsCount && callsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete talk script that is used in calls' },
        { status: 400 }
      )
    }

    // Delete talk script (CASCADE will delete hearing items)
    const { error: deleteError } = await supabase.from('talk_scripts').delete().eq('id', id)

    if (deleteError) {
      console.error('Error deleting talk script:', deleteError)
      return NextResponse.json({ error: 'Failed to delete talk script' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/talk-scripts/:id:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
