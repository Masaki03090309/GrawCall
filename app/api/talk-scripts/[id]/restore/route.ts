import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/talk-scripts/:id/restore
 * Restore a previous version of talk script (creates new version with old content)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Get talk script version to restore
    const { data: versionToRestore, error: fetchError } = await supabase
      .from('talk_scripts')
      .select(
        `
        *,
        hearing_items:talk_script_hearing_items(*)
      `
      )
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Talk script version not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch talk script version' }, { status: 500 })
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
        .eq('project_id', versionToRestore.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          {
            error: 'Insufficient permissions. Only owners and directors can restore talk scripts.',
          },
          { status: 403 }
        )
      }
    }

    // Deactivate all previous versions
    const { error: deactivateError } = await supabase
      .from('talk_scripts')
      .update({ is_active: false })
      .eq('project_id', versionToRestore.project_id)
      .eq('is_active', true)

    if (deactivateError) {
      console.error('Error deactivating previous versions:', deactivateError)
      return NextResponse.json({ error: 'Failed to deactivate previous versions' }, { status: 500 })
    }

    // Get next version number
    const { data: latestVersion, error: versionError } = await supabase
      .from('talk_scripts')
      .select('version')
      .eq('project_id', versionToRestore.project_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1

    // Create new version with old content
    const { data: newTalkScript, error: insertError } = await supabase
      .from('talk_scripts')
      .insert({
        project_id: versionToRestore.project_id,
        version: nextVersion,
        opening_script: versionToRestore.opening_script,
        proposal_script: versionToRestore.proposal_script,
        closing_script: versionToRestore.closing_script,
        created_by: user.id,
        change_comment: `Restored from version ${versionToRestore.version}`,
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating restored version:', insertError)
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 })
    }

    // Insert hearing items from old version
    if (versionToRestore.hearing_items && versionToRestore.hearing_items.length > 0) {
      const hearingItemsToInsert = versionToRestore.hearing_items.map(item => ({
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
        return NextResponse.json({ error: 'Failed to restore hearing items' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newTalkScript.id,
        version: newTalkScript.version,
        restored_from_version: versionToRestore.version,
        created_at: newTalkScript.created_at,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/talk-scripts/:id/restore:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
