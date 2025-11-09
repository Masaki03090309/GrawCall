'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
exports.generateFeedback = generateFeedback
const openai_1 = __importDefault(require('openai'))
const supabase_js_1 = require('@supabase/supabase-js')
const talkScriptAnalysis_1 = require('./talkScriptAnalysis')
const openai = new openai_1.default({
  apiKey: process.env.OPENAI_API_KEY,
})
const supabase = (0, supabase_js_1.createClient)(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
/**
 * Generate feedback for a call using GPT model
 * - Connected calls (60s+): Use 'connected' prompt with gpt-5-mini
 * - Reception calls: Use 'reception' prompt with gpt-5-nano
 *
 * @param transcriptText - Transcribed text from the call
 * @param status - Call status (connected/reception/no_conversation)
 * @param durationSeconds - Call duration in seconds
 * @param projectId - Project ID (optional, for project-specific prompts)
 * @param analysisResult - Talk script analysis result (optional, M3.3)
 * @returns FeedbackGenerationResult
 */
async function generateFeedback(
  transcriptText,
  status,
  durationSeconds,
  projectId,
  analysisResult
) {
  console.log('[Feedback] Starting feedback generation...')
  console.log(
    `[Feedback] Status: ${status}, Duration: ${durationSeconds}s, ProjectID: ${projectId || 'null'}`
  )
  // Check feedback generation conditions
  // Generate feedback for:
  // 1. Connected calls with duration >= 60s (use 'connected' prompt with gpt-5-mini)
  // 2. Reception calls (use 'reception' prompt with gpt-5-nano)
  const shouldGenerate = (status === 'connected' && durationSeconds >= 60) || status === 'reception'
  if (!shouldGenerate) {
    const skipReason =
      status === 'connected'
        ? `Duration is ${durationSeconds}s, less than 60s`
        : `Status is ${status}, not connected or reception`
    console.log(`[Feedback] Skipping feedback generation: ${skipReason}`)
    return {
      feedback_text: null,
      prompt_version_id: null,
      should_generate: false,
      skip_reason: skipReason,
    }
  }
  // Determine prompt type based on status
  const promptType = status === 'connected' ? 'connected' : 'reception'
  console.log(`[Feedback] Prompt type: ${promptType}`)
  // Step 1: Retrieve prompt (project-specific or default)
  console.log('[Feedback] Step 1: Retrieving prompt...')
  const prompt = await getActivePrompt(projectId, promptType)
  if (!prompt) {
    console.warn('[Feedback] No active prompt found, skipping feedback generation')
    return {
      feedback_text: null,
      prompt_version_id: null,
      should_generate: false,
      skip_reason: 'No active prompt available',
    }
  }
  console.log(`[Feedback] Using prompt: ${prompt.id} (version ${prompt.version})`)
  // Step 2: Generate feedback with appropriate model
  // Connected (60s+) → gpt-5-mini
  // Reception → gpt-5-nano
  const model = promptType === 'connected' ? 'gpt-5-mini' : 'gpt-5-nano'
  console.log(`[Feedback] Step 2: Generating feedback with ${model}...`)
  try {
    // Build enhanced system prompt with talk script analysis (M3.4 - Causality-aware feedback)
    const systemPrompt = buildSystemPrompt(prompt.content, analysisResult)
    // Build user prompt with analysis context
    const userPrompt = buildUserPrompt(transcriptText, durationSeconds, analysisResult)
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      // IMPORTANT: GPT-5/GPT-5-mini/GPT-5-nano does NOT support temperature, top_p, presence_penalty, frequency_penalty
      // These parameters are omitted as per technical guidelines
    })
    const feedbackText = completion.choices[0]?.message?.content
    if (!feedbackText) {
      console.error(`[Feedback] ${model} returned empty feedback`)
      return {
        feedback_text: null,
        prompt_version_id: prompt.id,
        should_generate: true,
        skip_reason: `${model} returned empty response`,
      }
    }
    console.log(`[Feedback] Feedback generated successfully (${feedbackText.length} characters)`)
    return {
      feedback_text: feedbackText,
      prompt_version_id: prompt.id,
      should_generate: true,
    }
  } catch (error) {
    console.error(`[Feedback] Error generating feedback with ${model}:`, error.message)
    return {
      feedback_text: null,
      prompt_version_id: prompt.id,
      should_generate: true,
      skip_reason: `${model} error: ${error.message}`,
    }
  }
}
/**
 * Get active prompt for feedback generation
 * Priority: Project-specific prompt > Default system prompt
 *
 * @param projectId - Project ID (optional)
 * @param promptType - Prompt type ('connected' or 'reception')
 * @returns Active prompt or null
 */
async function getActivePrompt(projectId, promptType) {
  try {
    // If projectId is provided, try to get project-specific prompt first
    if (projectId) {
      const { data: projectPrompt, error: projectError } = await supabase
        .from('prompts')
        .select('*')
        .eq('project_id', projectId)
        .eq('prompt_type', promptType)
        .eq('is_active', true)
        .maybeSingle()
      if (!projectError && projectPrompt) {
        console.log(
          `[Feedback] Found project-specific ${promptType} prompt for project ${projectId}`
        )
        return projectPrompt
      }
    }
    // Fallback to default system prompt (project_id IS NULL)
    const { data: defaultPrompt, error: defaultError } = await supabase
      .from('prompts')
      .select('*')
      .is('project_id', null)
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .maybeSingle()
    if (defaultError) {
      console.error(`[Feedback] Error fetching default ${promptType} prompt:`, defaultError)
      return null
    }
    if (defaultPrompt) {
      console.log(`[Feedback] Using default ${promptType} prompt`)
      return defaultPrompt
    }
    console.warn(
      `[Feedback] No active ${promptType} prompt found (neither project-specific nor default)`
    )
    return null
  } catch (error) {
    console.error('[Feedback] Error in getActivePrompt:', error.message)
    return null
  }
}
/**
 * Build enhanced system prompt with talk script analysis context (M3.4)
 */
function buildSystemPrompt(basePromptContent, analysisResult) {
  if (!analysisResult || !analysisResult.phase_match_rates) {
    // No talk script analysis - use base prompt
    return basePromptContent
  }
  const causalPattern = (0, talkScriptAnalysis_1.determineCausalPattern)(
    analysisResult.phase_match_rates
  )
  let causalInstructions = ''
  switch (causalPattern) {
    case 'hearing_insufficient':
      causalInstructions = `
【重要な因果関係分析】
ヒアリング不足が根本原因です。ヒアリングが不十分なため、提案・クロージングに進めませんでした。

フィードバックの重点:
1. **ヒアリング力の強化を最優先**
2. 未カバーのヒアリング項目を具体的に指摘
3. ニーズ・課題の顕在化テクニックを提案
4. 提案・クロージングの低さは、ヒアリング不足の結果であることを説明

※ 単純に一致率が低い順に指摘するのではなく、因果関係を考慮してください。`
      break
    case 'proposal_insufficient':
      causalInstructions = `
【重要な因果関係分析】
提案力不足が根本原因です。ヒアリングはできていますが、それを提案に活かせていません。

フィードバックの重点:
1. **ヒアリング内容と商品の強みを結びつける**
2. 学習資料や事例集の活用を推奨
3. 価値提案の明確化
4. 顧客のニーズに応じた具体的な提案例を示す`
      break
    case 'closing_insufficient':
      causalInstructions = `
【重要な因果関係分析】
クロージング不足が根本原因です。ヒアリング・提案は良好ですが、次のステップを提示できていません。

フィードバックの重点:
1. **アポイント打診の具体性を強化**
2. 次回訪問の日時提案を推奨
3. クロージングトークの実践例を提示
4. 「検討します」で終わらせない工夫を提案`
      break
    case 'general':
      causalInstructions = `
【因果関係分析】
営業プロセス全体の流れに沿って改善提案を行ってください。

フィードバックの重点:
1. 最も低いフェーズから順に指摘
2. 営業プロセスの流れ（オープニング→ヒアリング→提案→クロージング）を考慮
3. 前のフェーズの不足が後のフェーズに影響している可能性を検討`
      break
  }
  return `${basePromptContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Phase 3拡張: トークスクリプト分析結果の活用】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下のトークスクリプト一致率分析結果を参考に、因果関係を考慮した建設的なフィードバックを生成してください。

${causalInstructions}

【注意事項】
- 一致率が100%である必要はありません。70%以上なら「良好」と評価してください
- 表現が異なっても意図が伝わっていれば高く評価してください
- 未カバーのヒアリング項目については、次回必ず確認するよう具体的にアドバイスしてください`
}
/**
 * Build user prompt with analysis context (M3.4)
 */
function buildUserPrompt(transcriptText, durationSeconds, analysisResult) {
  const sections = []
  sections.push('以下の通話内容を分析し、フィードバックを生成してください。\n')
  sections.push(`通話時間: ${durationSeconds}秒\n`)
  // Add talk script analysis if available
  if (analysisResult && analysisResult.phase_match_rates && analysisResult.hearing_item_coverage) {
    sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    sections.push('【トークスクリプト一致率分析】\n')
    sections.push(`総合一致率: ${analysisResult.overall_match_rate}%\n`)
    sections.push('フェーズ別一致率:')
    sections.push(`- オープニング: ${analysisResult.phase_match_rates.opening}%`)
    sections.push(`- ヒアリング: ${analysisResult.phase_match_rates.hearing}%`)
    sections.push(`- 提案: ${analysisResult.phase_match_rates.proposal}%`)
    sections.push(`- クロージング: ${analysisResult.phase_match_rates.closing}%\n`)
    sections.push('ヒアリング項目カバー状況:')
    const coverageItems = Object.entries(analysisResult.hearing_item_coverage)
    coverageItems.forEach(([itemName, coverage]) => {
      const status = coverage.covered ? '✅ カバー済み' : '❌ 未カバー'
      const matchRate = coverage.covered ? `（一致率: ${coverage.match_rate}%）` : ''
      sections.push(`- ${itemName}: ${status}${matchRate}`)
    })
    sections.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }
  sections.push('文字起こし:')
  sections.push(transcriptText)
  return sections.join('\n')
}
//# sourceMappingURL=feedbackGeneration.js.map
