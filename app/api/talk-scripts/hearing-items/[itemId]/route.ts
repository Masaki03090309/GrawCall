import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateHearingItemSchema = z.object({
  item_name: z.string().min(1).max(255).optional(),
  item_script: z.string().min(1).optional(),
  display_order: z.number().int().min(1).optional(),
})

/**
 * PUT /api/talk-scripts/hearing-items/:itemId
 * Update a hearing item
 */
export async function PUT(request: NextRequest, { params }: { params: { itemId: string } }) {
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

    const { itemId } = params

    // Get hearing item
    const { data: hearingItem, error: fetchError } = await supabase
      .from('talk_script_hearing_items')
      .select(
        '*, talk_script:talk_scripts!talk_script_hearing_items_talk_script_id_fkey(project_id)'
      )
      .eq('id', itemId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Hearing item not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch hearing item' }, { status: 500 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = UpdateHearingItemSchema.parse(body)

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
        .eq('project_id', hearingItem.talk_script.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          {
            error: 'Insufficient permissions. Only owners and directors can update hearing items.',
          },
          { status: 403 }
        )
      }
    }

    // Update hearing item
    const updateData: any = {}
    if (validated.item_name !== undefined) {
      updateData.item_name = validated.item_name
    }
    if (validated.item_script !== undefined) {
      updateData.item_script = validated.item_script
    }
    if (validated.display_order !== undefined) {
      updateData.display_order = validated.display_order
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('talk_script_hearing_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating hearing item:', updateError)
      return NextResponse.json({ error: 'Failed to update hearing item' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedItem,
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

    console.error('Error in PUT /api/talk-scripts/hearing-items/:itemId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/talk-scripts/hearing-items/:itemId
 * Delete a hearing item (only if not default)
 */
export async function DELETE(request: NextRequest, { params }: { params: { itemId: string } }) {
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

    const { itemId } = params

    // Get hearing item
    const { data: hearingItem, error: fetchError } = await supabase
      .from('talk_script_hearing_items')
      .select(
        'is_default, talk_script:talk_scripts!talk_script_hearing_items_talk_script_id_fkey(project_id)'
      )
      .eq('id', itemId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Hearing item not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch hearing item' }, { status: 500 })
    }

    // Check if default item
    if (hearingItem.is_default) {
      return NextResponse.json({ error: 'Cannot delete default hearing item' }, { status: 400 })
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
        .eq('project_id', hearingItem.talk_script.project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData || memberData.role === 'user') {
        return NextResponse.json(
          {
            error: 'Insufficient permissions. Only owners and directors can delete hearing items.',
          },
          { status: 403 }
        )
      }
    }

    // Delete hearing item
    const { error: deleteError } = await supabase
      .from('talk_script_hearing_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      console.error('Error deleting hearing item:', deleteError)
      return NextResponse.json({ error: 'Failed to delete hearing item' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error in DELETE /api/talk-scripts/hearing-items/:itemId:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
