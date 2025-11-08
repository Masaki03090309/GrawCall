import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const origin = requestUrl.origin

  // Handle PKCE flow (code parameter)
  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
    }

    if (data.user) {
      const user = data.user
      const adminClient = createServiceRoleClient()

      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!existingUser) {
        const { error: insertError } = await adminClient.from('users').insert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split('@')[0],
          role: 'user',
        })

        if (insertError) {
          console.error('Error creating user record in callback:', insertError)
        }
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  // Handle email verification with token_hash
  if (token_hash && type) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (error) {
      console.error('Error verifying OTP:', error)
      return NextResponse.redirect(`${origin}/login?error=verification_error`)
    }

    if (data.user) {
      const user = data.user
      const adminClient = createServiceRoleClient()

      const { data: existingUser } = await adminClient
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!existingUser) {
        const { error: insertError } = await adminClient.from('users').insert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!.split('@')[0],
          role: 'user',
        })

        if (insertError) {
          console.error('Error creating user record in callback:', insertError)
        }
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  // If no code or token, redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
