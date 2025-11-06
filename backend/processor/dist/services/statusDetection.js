"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCallStatus = detectCallStatus;
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Detect call status using GPT-5-mini
 *
 * Status definitions:
 * - connected: Successfully reached decision maker, had meaningful conversation
 * - reception: Reached receptionist/gatekeeper, didn't reach decision maker
 * - no_conversation: No meaningful conversation (too short, voicemail, etc.)
 */
async function detectCallStatus(transcript, duration) {
    console.log('Detecting call status with GPT-5-mini...');
    // Rule-based pre-filtering
    if (duration < 10 || transcript.length < 20) {
        return {
            status: 'no_conversation',
            confidence: 1.0,
            reason: '通話時間が短すぎる、または文字起こしが短すぎる',
        };
    }
    // Keywords for quick detection
    const receptionKeywords = ['受付', '受け付け', '担当者', '代わります', '繋ぎます', 'お繋ぎ'];
    const hasReceptionKeyword = receptionKeywords.some(kw => transcript.includes(kw));
    if (hasReceptionKeyword && duration < 60) {
        return {
            status: 'reception',
            confidence: 0.9,
            reason: '受付キーワードが検出され、短い通話時間',
        };
    }
    try {
        // Use GPT-5-mini for classification
        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                {
                    role: 'system',
                    content: `あなたは営業電話の通話内容を分析し、以下の3つのステータスに分類する専門家です。

ステータスの定義:
1. connected: 意思決定者（担当者、責任者など）と繋がり、有意義な会話ができた
2. reception: 受付や取次担当者に当たり、意思決定者には繋がらなかった
3. no_conversation: 有意義な会話がなかった（留守電、すぐ切られた、など）

判定基準:
- 通話時間が60秒以上で、具体的な商談や提案があれば "connected"
- 「担当者に繋ぎます」「代わります」などがあり、その後会話がなければ "reception"
- 通話がすぐ終了、または留守電の場合は "no_conversation"

回答は必ず以下のJSON形式で返してください:
{
  "status": "connected" | "reception" | "no_conversation",
  "confidence": 0.0〜1.0,
  "reason": "判定理由を日本語で簡潔に"
}`,
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
        });
        const content = response.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);
        console.log('Status detection result:', result);
        return {
            status: result.status || 'no_conversation',
            confidence: result.confidence || 0.5,
            reason: result.reason || 'AI判定',
        };
    }
    catch (error) {
        console.error('Error detecting status with GPT-5-mini:', error.message);
        // Fallback to rule-based detection
        if (duration >= 60) {
            return {
                status: 'connected',
                confidence: 0.6,
                reason: 'GPT-5-mini判定失敗。通話時間に基づく推定。',
            };
        }
        else {
            return {
                status: 'no_conversation',
                confidence: 0.6,
                reason: 'GPT-5-mini判定失敗。通話時間に基づく推定。',
            };
        }
    }
}
//# sourceMappingURL=statusDetection.js.map