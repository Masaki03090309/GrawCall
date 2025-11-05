import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()

    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    return NextResponse.json({ message: 'ログアウトしました' }, { status: 200 })
  } catch (error: any) {
    console.error('Error logging out:', error)
    return NextResponse.json(
      { error: 'LOGOUT_ERROR', message: 'ログアウトに失敗しました' },
      { status: 500 }
    )
  }
}
