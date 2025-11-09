import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Validation schema
const FinalizeSchema = z.object({
  project_id: z.string().uuid(),
  prompt_type: z.enum(['connected', 'reception']),
  conversation_history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
  improvements: z.array(z.string()),
})

/**
 * POST /api/prompts/assistant/finalize
 * Generate final prompt using GPT-5
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
    const validationResult = FinalizeSchema.safeParse(body)

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

    const { project_id, prompt_type, conversation_history, improvements } = validationResult.data

    // Check permission
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
              message: 'プロンプトを作成する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    console.log('[Finalize] Starting final prompt generation with GPT-5...')

    // Get default prompt
    const { data: defaultPrompt } = await supabase
      .from('prompts')
      .select('*')
      .is('project_id', null)
      .eq('prompt_type', prompt_type)
      .eq('is_active', true)
      .maybeSingle()

    if (!defaultPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEFAULT_PROMPT_NOT_FOUND',
            message: 'システムデフォルトプロンプトが見つかりません',
          },
        },
        { status: 404 }
      )
    }

    // Call GPT-5 for final prompt generation
    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: buildFinalSystemPrompt(
            defaultPrompt.content,
            conversation_history,
            improvements
          ),
        },
      ],
    })

    const generatedPrompt = completion.choices[0].message.content || ''

    console.log('[Finalize] GPT-5 generation complete')
    console.log(`[Finalize] Generated prompt length: ${generatedPrompt.length} chars`)

    // Check if project already has a custom prompt
    const { data: existingPrompt } = await supabase
      .from('prompts')
      .select('version')
      .eq('project_id', project_id)
      .eq('prompt_type', prompt_type)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = existingPrompt ? existingPrompt.version + 1 : 1

    // Deactivate existing prompts
    await supabase
      .from('prompts')
      .update({ is_active: false })
      .eq('project_id', project_id)
      .eq('prompt_type', prompt_type)

    // Save new prompt
    const { data: newPrompt, error: insertError } = await supabase
      .from('prompts')
      .insert({
        project_id,
        prompt_type,
        content: generatedPrompt,
        is_active: true,
        version: nextVersion,
        created_by: user.id,
        change_comment: `プロンプトアシスタントで作成（改善点: ${improvements.length}件）`,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Finalize] Error saving prompt:', insertError)
      throw insertError
    }

    console.log('[Finalize] Prompt saved to database:', newPrompt.id)

    return NextResponse.json({
      success: true,
      data: {
        prompt: newPrompt,
        improvements,
        model_used: 'gpt-5',
      },
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバーエラーが発生しました',
          details: error.message,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Build system prompt for GPT-5 final generation
 */
function buildFinalSystemPrompt(
  defaultPromptContent: string,
  conversationHistory: Array<{ role: string; content: string }>,
  improvements: string[]
): string {
  const conversationText = conversationHistory
    .map(msg => `${msg.role === 'user' ? '👤 ユーザー' : '🤖 アシスタント'}: ${msg.content}`)
    .join('\n\n')

  return `あなたは営業フィードバック用プロンプトの最終生成エキスパートです。

【タスク】
ユーザーとアシスタントの会話履歴を深く理解し、
システムデフォルトプロンプトに改善点を完璧に統合した
プロジェクト専用プロンプトを生成してください。

【システムデフォルトプロンプト】
${defaultPromptContent}

【ユーザーとの全会話履歴】
${conversationText}

【抽出された改善点リスト】
${improvements.map((imp, idx) => `${idx + 1}. ${imp}`).join('\n')}

【出力要件】
1. デフォルトプロンプトの構造・トーンを維持
2. 改善点を自然に統合（違和感のない文章に）
3. 営業フィードバックとして実用的な内容
4. Few-shot例があれば具体的に記載
5. 評価基準は明確に数値化

【重要】
これが最終的なプロンプトです。
ユーザーの要望を100%反映した、完璧な品質のプロンプトを生成してください。

出力は、生成したプロンプト本文のみを返してください（説明や前置きは不要）。`
}
