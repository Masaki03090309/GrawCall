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

# 判定ステップ
1. 一人称の実務発言があるか？
   - 「私が」「私個人で」「当社では」「検討中」「課題を抱えている」
   → YES: connected確定（断られていてもconnected）

2. 本人確認＋要件の会話があるか？
   - 「◯◯様ですか？」→「はい」＋その後に要件や日程の話
   → YES: connected

3. 不在・外出シグナルのみか？
   - 「不在です」「外出中」「折返します」のみで終了
   → YES: reception

4. 会話が成立していないか？
   - 留守電・即切れ・無言
   → YES: no_conversation

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

## 例5: reception（取次不可）
文字起こし：
「佐藤様お願いします」「少々お待ちください」（10秒後）「申し訳ございません、ただいま会議中でして」「承知しました」
判定：
{"status": "reception", "confidence": 0.90, "reason": "取次試みたが会議中、受付で終了", "evidence": ["会議中でして"]}

## 例6: no_conversation
文字起こし：
「プルルル...ガイダンス：ただいま電話に出ることができません」
判定：
{"status": "no_conversation", "confidence": 1.0, "reason": "留守電のみ", "evidence": ["留守電ガイダンス"]}

# 出力形式（厳守）
{"status": "connected|reception|no_conversation", "confidence": 0.0-1.0, "reason": "判定理由", "evidence": ["根拠1", "根拠2", "根拠3"]}

# Confidence目安
- connected: 一人称発言複数=0.85-0.95、一人称1つ=0.70-0.85、本人確認のみ=0.60-0.75
- reception: 明確な不在=0.90-0.95、曖昧=0.60-0.80
- no_conversation: 留守電・即切れ=0.95-1.0`,
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
