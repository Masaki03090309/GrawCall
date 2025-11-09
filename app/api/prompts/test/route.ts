import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOpenAIClient } from '@/lib/openaiClient'

// Validation schema
const TestPromptSchema = z.object({
  project_id: z.string().uuid('有効なプロジェクトIDを入力してください'),
  prompt_content: z.string().min(1, 'プロンプト内容は必須です'),
  test_input: z.string().min(1, 'テスト入力は必須です'),
})

/**
 * POST /api/prompts/test
 * Test a prompt with GPT-5-nano
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '認証が必要です',
          },
        },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = TestPromptSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: validationResult.error.flatten(),
          },
        },
        { status: 422 }
      )
    }

    const { project_id, prompt_content, test_input } = validationResult.data

    // Check if user has access to this project
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'ユーザー情報が見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // If not owner, check if user is a member of this project
    if (userData.role !== 'owner') {
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single()

      if (memberError || !memberData) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'プロンプトをテストする権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Call OpenAI API with GPT-5-nano
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: prompt_content,
        },
        {
          role: 'user',
          content: test_input,
        },
      ],
      // Note: GPT-5-nano does not support temperature parameter
    })

    const response = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      success: true,
      data: {
        response,
        usage: completion.usage,
        model: completion.model,
      },
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'バリデーションエラー',
            details: error.flatten(),
          },
        },
        { status: 422 }
      )
    }

    // OpenAI API errors
    if (error.response) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OPENAI_API_ERROR',
            message: 'OpenAI APIエラーが発生しました',
            details: error.response.data,
          },
        },
        { status: error.response.status || 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
        },
      },
      { status: 500 }
    )
  }
}
