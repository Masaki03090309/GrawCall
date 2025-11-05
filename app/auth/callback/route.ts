import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    // If authentication successful, ensure user record exists in database
    if (!error && data.user) {
      const user = data.user

      // Check if user exists in database
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      // Create user record if it doesn't exist
      if (!existingUser) {
        await supabase.from('users').insert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split('@')[0],
          role: 'user',
        })
      }
    }
  }

  // Redirect to the home page after authentication
  return NextResponse.redirect(`${origin}/`)
}
