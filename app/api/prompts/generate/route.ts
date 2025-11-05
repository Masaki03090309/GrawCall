import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { z } from 'zod'

/**
 * POST /api/prompts/generate
 * AI Prompt Assistant: Generate prompt from audio recording
 *
 * Flow:
 * 1. Receive audio file (base64)
 * 2. Transcribe with Whisper API
 * 3. Generate prompt with GPT-5
 * 4. Return transcription and generated prompt
 */

const GeneratePromptSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'),
  prompt_type: z.enum(['connected', 'reception']),
  additional_context: z.string().optional(),
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    const body = await request.json()
    const validated = GeneratePromptSchema.parse(body)

    // Step 1: Convert base64 to buffer
    const base64Data = validated.audio.split(',')[1] || validated.audio
    const audioBuffer = Buffer.from(base64Data, 'base64')

    // Create a File-like object for Whisper API
    const audioFile = new File([audioBuffer], 'audio.webm', {
      type: 'audio/webm',
    })

    // Step 2: Transcribe audio with Whisper API
    console.log('Transcribing audio with Whisper API...')
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ja',
    })

    const transcribedText = transcription.text
    console.log('Transcription complete:', transcribedText.substring(0, 100))

    // Step 3: Generate prompt with GPT-5
    console.log('Generating prompt with GPT-5...')

    const promptTypeLabel =
      validated.prompt_type === 'connected'
        ? 'つながった通話用プロンプト'
        : '受付に当たった通話用プロンプト'

    const systemPrompt = `あなたは営業通話分析AIのプロンプトエンジニアです。
ユーザーが録音した音声から、営業フィードバック生成用のプロンプトを作成してください。

プロンプトタイプ: ${promptTypeLabel}

要件:
1. 文字起こしされたテキストから、ユーザーが求める分析の要点を抽出する
2. 営業通話の文字起こしテキストを分析し、建設的なフィードバックを生成するためのプロンプトを作成する
3. プロンプトは具体的で、AIが理解しやすい形式にする
4. 以下の観点を含める:
   - 分析すべきポイント（話し方、ヒアリング、提案力、クロージングなど）
   - フィードバックの形式（段落構成、項目など）
   - 重視すべき要素
5. プロンプトは日本語で記述する
6. マークダウン形式で構造化する

${validated.additional_context ? `追加コンテキスト: ${validated.additional_context}` : ''}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Use GPT-4o for prompt generation (GPT-5 not available yet)
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `以下の音声文字起こしから、営業フィードバック生成用のプロンプトを作成してください:\n\n${transcribedText}`,
        },
      ],
    })

    const generatedPrompt = completion.choices[0].message.content || ''
    console.log('Prompt generation complete')

    return NextResponse.json({
      success: true,
      data: {
        transcription: transcribedText,
        generated_prompt: generatedPrompt,
        prompt_type: validated.prompt_type,
        usage: {
          transcription_length: transcribedText.length,
          prompt_length: generatedPrompt.length,
        },
      },
    })
  } catch (error: any) {
    console.error('Error generating prompt:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '入力データが不正です',
            details: error.errors,
          },
        },
        { status: 422 }
      )
    }

    // OpenAI API errors
    if (error.response?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OPENAI_AUTH_ERROR',
            message: 'OpenAI APIの認証に失敗しました',
          },
        },
        { status: 500 }
      )
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OPENAI_RATE_LIMIT',
            message: 'OpenAI APIのレート制限に達しました。しばらくしてから再試行してください。',
          },
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'プロンプト生成中にエラーが発生しました',
          details: error.message,
        },
      },
      { status: 500 }
    )
  }
}
