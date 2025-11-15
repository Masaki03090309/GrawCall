import OpenAI from 'openai'

/**
 * Extracted talk script data from PDF
 */
export interface ExtractedTalkScript {
  opening_script: string
  hearing_items: Array<{
    item_name: string
    item_script: string
  }>
  proposal_script: string
  closing_script: string
}

/**
 * Extract and classify talk script from PDF using GPT-5 Vision API
 *
 * @param pdfBuffer - PDF file buffer
 * @returns Extracted and classified talk script data
 * @throws Error if GPT-5 Vision API call fails
 */
export async function extractTalkScriptFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedTalkScript> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  // Convert PDF buffer to base64
  const base64 = pdfBuffer.toString('base64')

  const systemPrompt = `あなたはトークスクリプト分析AIです。営業トークスクリプトのPDFを読み取り、以下の4つのフェーズに分類してください:

【フェーズ定義】
1. **オープニング**: 挨拶、自己紹介、アイスブレイク、通話の目的説明
2. **ヒアリング**: 顧客の課題・ニーズ・状況を引き出す質問、現状把握
3. **提案**: 商品・サービスの説明、価値提案、メリット説明、事例紹介
4. **クロージング**: アポイント打診、次回アクション提示、契約への誘導

【重要な指示】
- ヒアリングフェーズから具体的な質問項目を抽出してください（最大10個まで）
- 各フェーズのスクリプトは、実際のトーク例として使える形式で出力してください
- 必ず「現在の課題」という名前のヒアリング項目を含めてください（デフォルト項目）
- 出力は必ずJSON形式で、以下の構造に従ってください

【出力形式（JSON）】
{
  "opening_script": "こんにちは、株式会社○○の△△と申します。本日は...",
  "hearing_items": [
    { "item_name": "現在の課題", "item_script": "現在、業務上で特にお困りのことはございますか？" },
    { "item_name": "予算感", "item_script": "ご予算についてはどのようにお考えでしょうか？" }
  ],
  "proposal_script": "弊社のサービスは、お客様の課題を解決するために...",
  "closing_script": "それでは、一度詳しくご説明させていただく機会をいただけないでしょうか？"
}

【注意事項】
- PDFの内容が営業トークスクリプトでない場合は、エラーメッセージを含むJSONを返してください
- 出力は必ず有効なJSON形式にしてください
- 各スクリプトは実践的で具体的な内容にしてください`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'このPDFのトークスクリプトを4つのフェーズに分類し、ヒアリング項目を抽出してください。'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('GPT-5 Vision API returned empty response')
    }

    const extracted = JSON.parse(content) as ExtractedTalkScript

    // Validation
    if (!extracted.opening_script || !extracted.proposal_script ||
        !extracted.closing_script || !Array.isArray(extracted.hearing_items)) {
      throw new Error('Invalid response format from GPT-5 Vision API')
    }

    // Ensure "現在の課題" is included
    const hasDefaultItem = extracted.hearing_items.some(
      item => item.item_name === '現在の課題'
    )

    if (!hasDefaultItem) {
      extracted.hearing_items.unshift({
        item_name: '現在の課題',
        item_script: '現在、業務上で特にお困りのことはございますか？'
      })
    }

    // Limit hearing items to 10
    if (extracted.hearing_items.length > 10) {
      extracted.hearing_items = extracted.hearing_items.slice(0, 10)
    }

    return extracted

  } catch (error) {
    console.error('GPT-5 Vision API error:', error)

    if (error instanceof Error) {
      throw new Error(`Failed to extract talk script from PDF: ${error.message}`)
    }

    throw new Error('Failed to extract talk script from PDF: Unknown error')
  }
}

/**
 * Validate PDF file before processing
 *
 * @param file - File object from form data
 * @param maxSizeBytes - Maximum file size in bytes (default: 10MB)
 * @returns Validation result with error message if invalid
 */
export function validatePDFFile(
  file: File,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB
): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'PDFファイルのみアップロード可能です'
    }
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024)
    return {
      valid: false,
      error: `ファイルサイズは${maxSizeMB}MB以下にしてください`
    }
  }

  // Check file name
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      error: 'ファイル名の拡張子が.pdfではありません'
    }
  }

  return { valid: true }
}
