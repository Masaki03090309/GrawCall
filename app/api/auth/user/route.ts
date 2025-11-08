import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '認証されていません' } },
        { status: 401 }
      )
    }

    // Get user details from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', user.id)
      .single()

    if (userError) {
      // If user doesn't exist in users table, create a new record
      if (userError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.email!.split('@')[0],
            role: 'user', // Default role
          })
          .select('id, name, email, role, created_at')
          .single()

        if (createError) {
          throw createError
        }

        return NextResponse.json({
          success: true,
          data: newUser,
          projects: [],
        })
      }

      throw userError
    }

    // Get user's projects
    const { data: projects, error: projectsError } = await supabase
      .from('project_members')
      .select(
        `
        project_id,
        role,
        projects:project_id (
          id,
          name,
          created_at
        )
      `
      )
      .eq('user_id', user.id)

    if (projectsError) {
      throw projectsError
    }

    // Format projects data
    const formattedProjects =
      projects?.map((pm: any) => ({
        id: pm.projects.id,
        name: pm.projects.name,
        role: pm.role,
        created_at: pm.projects.created_at,
      })) || []

    return NextResponse.json({
      success: true,
      data: userData,
      projects: formattedProjects,
    })
  } catch (error: any) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'ユーザー情報の取得に失敗しました' },
      },
      { status: 500 }
    )
  }
}
