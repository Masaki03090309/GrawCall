import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schemas
const GetTalkScriptSchema = z.object({
  project_id: z.string().uuid(),
})

const HearingItemSchema = z.object({
  item_name: z.string().min(1).max(255),
  item_script: z.string().min(1),
  is_default: z.boolean().default(false),
  display_order: z.number().int().min(1),
})

const CreateTalkScriptSchema = z.object({
  project_id: z.string().uuid(),
  opening_script: z.string().optional(),
  proposal_script: z.string().optional(),
  closing_script: z.string().optional(),
  hearing_items: z.array(HearingItemSchema).max(10),
  change_comment: z.string().optional(),
})

/**
 * GET /api/talk-scripts
 * Get talk script for a project (latest active version)
 */
export async function GET(request: NextRequest) {
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

    // Validate query params
    const searchParams = request.nextUrl.searchParams
    const project_id = searchParams.get('project_id')

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      )
    }

    const validated = GetTalkScriptSchema.parse({ project_id })

    // Get latest active talk script with hearing items
    const { data: talkScript, error: talkScriptError } = await supabase
      .from('talk_scripts')
      .select(
        `
        *,
        created_by:users!talk_scripts_created_by_fkey(id, name),
        hearing_items:talk_script_hearing_items(*)
      `
      )
      .eq('project_id', validated.project_id)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (talkScriptError) {
      if (talkScriptError.code === 'PGRST116') {
        // No talk script found
        return NextResponse.json(
          {
            success: true,
            data: null,
          },
          { status: 200 }
        )
      }
      console.error('Error fetching talk script:', talkScriptError)
      return NextResponse.json(
        { error: 'Failed to fetch talk script' },
        { status: 500 }
      )
    }

    // Sort hearing items by display_order
    const sortedHearingItems = (talkScript.hearing_items || []).sort(
      (a, b) => a.display_order - b.display_order
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
        created_at: talkScript.created_at,
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

    console.error('Error in GET /api/talk-scripts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/talk-scripts
 * Create new talk script
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validated = CreateTalkScriptSchema.parse(body)

    // Check user role (owner or director)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    // Check if user is owner or director of this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', validated.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only owners and directors can create talk scripts.' },
          { status: 403 }
        )
      }
    }

    // Deactivate previous versions
    const { error: deactivateError } = await supabase
      .from('talk_scripts')
      .update({ is_active: false })
      .eq('project_id', validated.project_id)
      .eq('is_active', true)

    if (deactivateError) {
      console.error('Error deactivating previous versions:', deactivateError)
      return NextResponse.json(
        { error: 'Failed to deactivate previous versions' },
        { status: 500 }
      )
    }

    // Get next version number
    const { data: latestVersion, error: versionError } = await supabase
      .from('talk_scripts')
      .select('version')
      .eq('project_id', validated.project_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = latestVersion ? latestVersion.version + 1 : 1

    // Insert new talk script
    const { data: newTalkScript, error: insertError } = await supabase
      .from('talk_scripts')
      .insert({
        project_id: validated.project_id,
        version: nextVersion,
        opening_script: validated.opening_script || null,
        proposal_script: validated.proposal_script || null,
        closing_script: validated.closing_script || null,
        created_by: user.id,
        change_comment: validated.change_comment || 'Initial version',
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting talk script:', insertError)
      return NextResponse.json(
        { error: 'Failed to create talk script' },
        { status: 500 }
      )
    }

    // Insert hearing items
    if (validated.hearing_items && validated.hearing_items.length > 0) {
      const hearingItemsToInsert = validated.hearing_items.map((item) => ({
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
        // Rollback talk script
        await supabase.from('talk_scripts').delete().eq('id', newTalkScript.id)
        return NextResponse.json(
          { error: 'Failed to create hearing items' },
          { status: 500 }
        )
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

    console.error('Error in POST /api/talk-scripts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
