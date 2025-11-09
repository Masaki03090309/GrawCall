import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { searchRAG } from '@/lib/ragUtils'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Validation schema
const ChatSchema = z.object({
  project_id: z.string().uuid(),
  prompt_type: z.enum(['connected', 'reception']),
  user_message: z.string().min(1),
  conversation_history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
})

/**
 * POST /api/prompts/assistant/chat
 * Chat with prompt assistant (GPT-5-mini)
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
    const validationResult = ChatSchema.safeParse(body)

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

    const { project_id, prompt_type, user_message, conversation_history } = validationResult.data

    // Check permission (director or owner)
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

    // If not owner, check if user is a project member
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
              message: 'プロンプトアシスタントを使用する権限がありません',
            },
          },
          { status: 403 }
        )
      }
    }

    // Get default prompt
    const { data: defaultPrompt } = await supabase
      .from('prompts')
      .select('*')
      .is('project_id', null)
      .eq('prompt_type', prompt_type)
      .eq('is_active', true)
      .maybeSingle()

    // RAG search using semantic similarity
    console.log('[Chat] Starting RAG search for:', user_message)
    const ragResults = await searchRAG(user_message, 3, 0.3) // Top 3 results, 30% similarity threshold

    // Extract improvements from conversation history
    const improvements = extractImprovements([
      ...conversation_history,
      { role: 'user', content: user_message },
    ])

    // Call GPT-5-mini for chat
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(defaultPrompt?.content || '', ragResults, improvements),
        },
        ...conversation_history.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        {
          role: 'user',
          content: user_message,
        },
      ],
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0].message.content || '{}'
    const result = JSON.parse(responseText)

    // Update improvements list
    const updatedImprovements = result.improvements || improvements

    return NextResponse.json({
      success: true,
      data: {
        ai_message: result.message || 'エラーが発生しました',
        improvements: updatedImprovements,
        ready_to_generate: result.ready_to_generate || false,
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
 * Build system prompt for GPT-5-mini chat
 */
function buildSystemPrompt(
  defaultPromptContent: string,
  ragResults: string[],
  currentImprovements: string[]
): string {
  return `あなたは営業フィードバックのプロンプトアシスタントです。

【最重要ミッション】
ユーザーの改善要望を**具体的に**ヒアリングする。RAG検索結果を活用し、プロンプト作成のプロとして導く。

【ヒアリング方針】
1. **RAG検索結果を必ず参考にする**
   - 関連資料があれば、そこから具体例や観点を引用してヒアリング
   - 例: 「RAG資料によると、〇〇という観点もありますが、この点はいかがですか？」

2. **段階的に深掘りする**
   - 最初: 大まかな改善方向を聞く
   - 次: 具体的な基準・例を聞く（「どの程度厳しく？」「具体的には？」）
   - 最後: Few-shot例や評価軸を聞く

3. **返信スタイル**
   - 4-5文で返す（簡潔だが必要な情報は削らない）
   - **段落ごとに改行を入れる**（読みやすさ重視）
   - 質問は1-2個（ヒアリングが最優先）
   - 具体例を1-2個挙げて選択肢を示す

【ニーズが固まったと判断する基準】
✅ 2つ以上の具体的改善点が出た
✅ 各改善点について「どの程度」「どんな基準」が明確
✅ ユーザーが「これでいい」と肯定した

【ニーズが固まったら】
「承知しました！改善点がまとまりましたね。

1. [改善点1の具体的な内容]
2. [改善点2の具体的な内容]

画面上部の「改善内容をまとめてプロンプトを作成」ボタンを押してください！GPT-5が高品質なプロンプトを生成します。」

【禁止事項】
❌ ヒアリングせずにいきなり提案する
❌ RAG検索結果を無視する
❌ 抽象的なまま次に進む

【現在のベースプロンプト（システムデフォルト）】
${defaultPromptContent || '（デフォルトプロンプト未設定）'}

【プロンプト作成ガイド（RAG検索結果）】
${ragResults.length > 0 ? ragResults.join('\n\n---\n\n') : '（関連する資料が見つかりませんでした。基本的なガイダンスで対応します）'}

【現在の改善点リスト】
${currentImprovements.length > 0 ? currentImprovements.map((imp, idx) => `${idx + 1}. ${imp}`).join('\n') : '（まだありません）'}

【出力形式】
必ず以下のJSON形式で返してください：
{
  "message": "ユーザーへのメッセージ（段落ごとに\\nで改行を入れる）",
  "ready_to_generate": true/false,
  "improvements": ["改善点1", "改善点2", ...]
}

【messageフィールドの例】
"承知しました。フィードバックを厳しめにしたいのですね。\\n\\n具体的にはどのような点を厳しくしたいですか？例えば：\\n1. ヒアリング項目の網羅率\\n2. 提案内容の具体性\\n\\nどちらの観点を重視しますか？"`
}

/**
 * Extract improvements from conversation history
 */
function extractImprovements(messages: Array<{ role: string; content: string }>): string[] {
  // Simple keyword-based extraction (will be enhanced with GPT later)
  const improvements: string[] = []
  const keywords = ['評価', '追加', '厳しく', '明確', '特化', 'アポ', 'ヒアリング', '展示会']

  for (const msg of messages) {
    if (msg.role === 'user') {
      for (const keyword of keywords) {
        if (msg.content.includes(keyword) && !improvements.some(imp => imp.includes(keyword))) {
          improvements.push(msg.content.substring(0, 50)) // First 50 chars as summary
          break
        }
      }
    }
  }

  return improvements.slice(0, 5) // Max 5 improvements
}
