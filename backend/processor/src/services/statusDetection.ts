import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type CallStatus = 'connected' | 'reception' | 'no_conversation'

export interface StatusDetectionResult {
  status: CallStatus
  confidence: number
  reason: string
}

/**
 * Detect call status using GPT-5-nano
 *
 * Status definitions:
 * - connected: Successfully reached decision maker, had meaningful conversation
 * - reception: Reached receptionist/gatekeeper, didn't reach decision maker
 * - no_conversation: No meaningful conversation (too short, voicemail, etc.)
 */
export async function detectCallStatus(
  transcript: string,
  duration: number
): Promise<StatusDetectionResult> {
  console.log('Detecting call status with GPT-5-nano...')

  // Rule-based pre-filtering
  if (duration < 10 || transcript.length < 20) {
    return {
      status: 'no_conversation',
      confidence: 1.0,
      reason: '通話時間が短すぎる、または文字起こしが短すぎる',
    }
  }

  // Keywords for quick detection
  const receptionKeywords = ['受付', '受け付け', '担当者', '代わります', '繋ぎます', 'お繋ぎ']
  const hasReceptionKeyword = receptionKeywords.some(kw => transcript.includes(kw))

  if (hasReceptionKeyword && duration < 60) {
    return {
      status: 'reception',
      confidence: 0.9,
      reason: '受付キーワードが検出され、短い通話時間',
    }
  }

  try {
    // Use GPT-5-nano for classification with strict prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `あなたはインサイドセールスの通話を3分類する専門家です。文字起こしのみを根拠に判定し、JSONオブジェクト1個のみを出力します。

# 3分類の定義
- "connected": 担当者本人と要件の会話をした（アポ獲得・断られた両方含む）
- "reception": 受付で終了（担当者不在・取次不可）
- "no_conversation": 会話が成立しなかった

# 重要な前提
- 文字起こしの話者名は不正確な場合がある（話者名だけで判定しない）
- 一人称発言（「私が」「当社では」「検討している」）があれば担当者本人
- 受付担当者は決して一人称で実務判断を語らない

# 判定ステップ（優先順位順）

## ステップ1: 担当者不在シグナルの確認（最優先）
以下の明確な不在シグナルがあれば**必ずreception**:
- 「◯◯様いらっしゃいますか？」→「不在です」「外出中」「本日不在」「会議中」「席を外している」
- 「◯◯様お願いします」→取次試みたが不在・会議中で繋がらなかった
- 折返し・伝言のみで終了（担当者と直接話していない）
→ **reception確定**（会話時間や内容に関わらず）

## ステップ2: 実務会話の有無確認
担当者不在でない場合、実務の会話があるか？
- 一人称の実務発言：「私が担当」「当社では検討中」「課題を抱えている」「予算は◯◯」
- 具体的な意思決定：「検討します」「社内で確認します」「興味あります」「不要です」
- アポイント調整：「◯月◯日なら」「スケジュール確認します」
→ YES: **connected**（断られた場合もconnected）

## ステップ3: 受付との会話のみか？
- 担当者への取次依頼のみ
- 在席確認・出社予定の確認のみ
- 「お繋ぎします」「少々お待ちください」のみで実務会話なし
→ YES: **reception**

## ステップ4: 会話が成立していないか？
- 留守電・即切れ・無言・ガイダンスのみ
→ YES: **no_conversation**

# 判定例（Few-shot Examples）

## 例1: connected（アポ獲得）
文字起こし：
「田中様ですか？」「はい」「デモのお時間いただけますか？」「来週水曜なら大丈夫です」
判定：
{"status": "connected", "confidence": 0.95, "reason": "本人確認後、アポイント獲得", "evidence": ["田中様ですか？→はい", "来週水曜なら大丈夫"]}

## 例2: connected（断られたケース）
文字起こし：
「和田様ですか？」「はい」「展示会の件で」「情報収集段階で、私個人で見に行っただけです」「課題は抱えていますが、着手の予定はないです」「そもそもしない可能性もあります」
判定：
{"status": "connected", "confidence": 0.85, "reason": "本人確認後、一人称で実務判断を語っている。断られたが担当者本人との会話", "evidence": ["和田様ですか→はい", "私個人で見に行った", "課題は抱えている", "しない可能性もある"]}

## 例3: connected（話者名が違うが一人称発言あり）
文字起こし：
話者A「山本様の件で」
話者B「はい、当社でも検討していました」「社内で展開するかは未定です」
判定：
{"status": "connected", "confidence": 0.80, "reason": "話者名は不明だが、一人称で実務判断。担当者本人と判定", "evidence": ["当社でも検討していた", "社内で展開するかは未定"]}

## 例4: reception（不在）
文字起こし：
「鈴木様いらっしゃいますか？」「あいにく外出中です」「戻りは？」「夕方の予定です」「では改めます」
判定：
{"status": "reception", "confidence": 0.95, "reason": "担当者不在、受付対応のみ", "evidence": ["外出中です", "夕方の予定"]}

## 例5: reception（取次不可・会議中）
文字起こし：
「佐藤様お願いします」「少々お待ちください」（10秒後）「申し訳ございません、ただいま会議中でして」「承知しました」
判定：
{"status": "reception", "confidence": 0.95, "reason": "取次試みたが会議中、受付で終了", "evidence": ["会議中でして"]}

## 例5-2: reception（担当者不在・在席確認のみ）
文字起こし：
「人事部の大内様いらっしゃいますでしょうか」「大内は本日不在ですけれども」「明日はご出社のご予定ございますか」「現在のところ出社予定ですが、場合によって在宅になる可能性もございます」
判定：
{"status": "reception", "confidence": 0.95, "reason": "担当者不在。在席確認のみで実務会話なし", "evidence": ["大内は本日不在", "出社予定の確認のみ", "実務会話なし"]}

## 例5-3: reception（部署移動・担当者変更）
文字起こし：
「人事部の安藤様はいらっしゃいますでしょうか」「私ですが部署移動となってしまって」「そうなったんですね」
判定：
{"status": "reception", "confidence": 0.90, "reason": "担当者が部署移動済み。実務会話なし", "evidence": ["部署移動となってしまって", "実務会話なし"]}

## 例6: no_conversation
文字起こし：
「プルルル...ガイダンス：ただいま電話に出ることができません」
判定：
{"status": "no_conversation", "confidence": 1.0, "reason": "留守電のみ", "evidence": ["留守電ガイダンス"]}

# 出力形式（厳守）
{"status": "connected|reception|no_conversation", "confidence": 0.0-1.0, "reason": "判定理由", "evidence": ["根拠1", "根拠2", "根拠3"]}

# Confidence目安
- connected: 一人称発言複数＋実務会話=0.90-0.95、一人称1つ＋実務会話=0.80-0.90、実務会話のみ=0.70-0.80
- reception: 「不在」「外出」「会議中」明言=0.90-0.95、取次試みたが不在=0.85-0.90、在席確認のみ=0.80-0.90
- no_conversation: 留守電・即切れ・ガイダンス=0.95-1.0

# 重要な注意事項
- **「不在」「外出」「会議中」「席を外している」が明確に発言されている場合、必ずreception判定**
- 担当者と直接話していない場合（受付とのみ会話）は、会話時間が長くてもreception
- 実務会話（検討、予算、課題、スケジュール等）がない場合はreception`,
        },
        {
          role: 'user',
          content: `以下の通話内容を分析してください。

通話時間: ${duration}秒
文字起こし:
${transcript}`,
        },
      ],
      // Note: GPT-5-mini does not support temperature parameter (removed per CLAUDE.md guidelines)
    })

    const content = response.choices[0]?.message?.content || '{}'
    const result = JSON.parse(content)

    console.log('Status detection result:', result)

    return {
      status: result.status || 'no_conversation',
      confidence: result.confidence || 0.5,
      reason: result.reason || 'AI判定',
    }
  } catch (error: any) {
    console.error('Error detecting status with GPT-5-nano:', error.message)

    // Fallback to rule-based detection
    if (duration >= 60) {
      return {
        status: 'connected',
        confidence: 0.6,
        reason: 'GPT-5-nano判定失敗。通話時間に基づく推定。',
      }
    } else {
      return {
        status: 'no_conversation',
        confidence: 0.6,
        reason: 'GPT-5-nano判定失敗。通話時間に基づく推定。',
      }
    }
  }
}
