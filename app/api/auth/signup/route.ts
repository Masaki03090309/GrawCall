import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Validation schema
const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

/**
 * POST /api/auth/signup - Create new user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = SignupSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.issues,
          },
        },
        { status: 422 }
      )
    }

    const { name, email, password } = validationResult.data

    const supabase = createServiceRoleClient()

    // Sign up with Supabase Auth (using service role for admin.createUser)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (signUpError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SIGNUP_ERROR',
            message: signUpError.message,
          },
        },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SIGNUP_ERROR',
            message: 'Failed to create user',
          },
        },
        { status: 400 }
      )
    }

    // Create user record in users table using service role
    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: authData.user.email!,
      name: name,
      role: 'user', // Default role
    })

    if (insertError) {
      // Check if it's a duplicate key error (user already exists)
      if (insertError.code === '23505') {
        console.warn('User record already exists:', insertError)
      } else {
        console.error('Error creating user record:', insertError)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Failed to create user record: ' + insertError.message,
            },
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user: authData.user,
      },
    })
  } catch (error: any) {
    console.error('Unexpected error in POST /api/auth/signup:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: error.issues,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}
