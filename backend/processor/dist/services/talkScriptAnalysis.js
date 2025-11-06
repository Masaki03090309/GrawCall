"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTalkScriptMatch = analyzeTalkScriptMatch;
exports.determineCausalPattern = determineCausalPattern;
const openai_1 = __importDefault(require("openai"));
const supabase_js_1 = require("@supabase/supabase-js");
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Analyze semantic match rate between talk script and actual call transcript
 * Uses GPT-5-mini for semantic (meaning-based) matching
 */
async function analyzeTalkScriptMatch(transcript, projectId) {
    console.log('Analyzing talk script match...');
    // If no project, skip analysis
    if (!projectId) {
        console.log('No project ID - skipping talk script analysis');
        return { should_analyze: false };
    }
    try {
        // Step 1: Fetch active talk script for project
        console.log(`Fetching active talk script for project ${projectId}...`);
        const { data: talkScriptData, error: talkScriptError } = await supabase
            .from('talk_scripts')
            .select(`
        id,
        opening_script,
        proposal_script,
        closing_script,
        talk_script_hearing_items (
          item_name,
          item_script,
          display_order
        )
      `)
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (talkScriptError) {
            console.error('Error fetching talk script:', talkScriptError);
            return { should_analyze: false };
        }
        if (!talkScriptData) {
            console.log('No active talk script found for project');
            return { should_analyze: false };
        }
        const talkScript = {
            opening_script: talkScriptData.opening_script,
            proposal_script: talkScriptData.proposal_script,
            closing_script: talkScriptData.closing_script,
            hearing_items: talkScriptData.talk_script_hearing_items?.map((item) => ({
                item_name: item.item_name,
                item_script: item.item_script,
            })) || [],
        };
        console.log(`Talk script found: ${talkScript.hearing_items.length} hearing items, opening=${!!talkScript.opening_script}, proposal=${!!talkScript.proposal_script}, closing=${!!talkScript.closing_script}`);
        // Step 2: Build prompt for GPT-5-mini
        const systemPrompt = `あなたは営業通話分析AIです。トークスクリプトと実際の通話内容を比較し、各フェーズの意味的な一致率を評価してください。

【重要な評価基準】
- **セマンティック（意味的）一致**: 表現が異なっても、意図や内容が同じなら高い一致率
- **キーワード一致ではない**: 「現在の課題は？」と「今困ってることある？」は意味的に同じ
- **評価は0〜100の整数**: 0（全く触れていない）〜100（完全に一致）

【出力形式（JSON）】
必ず以下のJSON形式で出力してください。各値は0〜100の整数です：

{
  "overall_match_rate": 76,
  "phase_match_rates": {
    "opening": 85,
    "hearing": 68,
    "proposal": 78,
    "closing": 73
  },
  "hearing_item_coverage": {
    "現在の課題": { "covered": true, "match_rate": 82 },
    "予算感": { "covered": false, "match_rate": 0 }
  }
}`;
        const userPrompt = buildAnalysisPrompt(talkScript, transcript);
        console.log('Calling GPT-5-mini for semantic matching...');
        // Step 3: Call GPT-5-mini
        const completion = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3, // Lower temperature for more consistent analysis
            response_format: { type: 'json_object' },
        });
        const responseText = completion.choices[0].message.content || '{}';
        console.log('GPT-5-mini analysis response received');
        // Step 4: Parse response
        let analysisData;
        try {
            analysisData = JSON.parse(responseText);
        }
        catch (parseError) {
            console.error('Failed to parse GPT-5-mini response:', parseError);
            return { should_analyze: false };
        }
        // Validate and return
        if (typeof analysisData.overall_match_rate === 'number' &&
            analysisData.phase_match_rates &&
            analysisData.hearing_item_coverage) {
            console.log(`Analysis complete: overall=${analysisData.overall_match_rate}%, hearing=${analysisData.phase_match_rates.hearing}%`);
            return {
                should_analyze: true,
                overall_match_rate: analysisData.overall_match_rate,
                phase_match_rates: analysisData.phase_match_rates,
                hearing_item_coverage: analysisData.hearing_item_coverage,
            };
        }
        else {
            console.error('Invalid analysis data structure:', analysisData);
            return { should_analyze: false };
        }
    }
    catch (error) {
        console.error('Error in talk script analysis:', error);
        return { should_analyze: false };
    }
}
/**
 * Build analysis prompt with talk script and transcript
 */
function buildAnalysisPrompt(talkScript, transcript) {
    const sections = [];
    sections.push('【トークスクリプト】\n');
    // Opening
    if (talkScript.opening_script) {
        sections.push(`■ オープニング:\n${talkScript.opening_script}\n`);
    }
    // Hearing items
    if (talkScript.hearing_items.length > 0) {
        sections.push('■ ヒアリング:');
        talkScript.hearing_items.forEach((item) => {
            sections.push(`  - ${item.item_name}: ${item.item_script}`);
        });
        sections.push('');
    }
    // Proposal
    if (talkScript.proposal_script) {
        sections.push(`■ 提案:\n${talkScript.proposal_script}\n`);
    }
    // Closing
    if (talkScript.closing_script) {
        sections.push(`■ クロージング:\n${talkScript.closing_script}\n`);
    }
    sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    sections.push('【実際の通話（文字起こし）】\n');
    sections.push(transcript.substring(0, 8000)); // Limit to 8000 chars to avoid token limits
    sections.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    sections.push('上記のトークスクリプトと実際の通話を比較し、JSON形式で評価結果を出力してください。');
    return sections.join('\n');
}
/**
 * Determine causal pattern based on match rates
 * Used for generating causality-aware feedback
 */
function determineCausalPattern(phaseMatchRates) {
    const { opening, hearing, proposal, closing } = phaseMatchRates;
    // Pattern A: Hearing insufficient
    if (hearing < 60 && (proposal < 30 || closing < 30)) {
        return 'hearing_insufficient';
    }
    // Pattern B: Proposal insufficient
    if (hearing >= 60 && proposal < 50 && closing < 50) {
        return 'proposal_insufficient';
    }
    // Pattern C: Closing insufficient
    if (hearing >= 60 && proposal >= 60 && closing < 50) {
        return 'closing_insufficient';
    }
    // Pattern D: General (other cases)
    return 'general';
}
//# sourceMappingURL=talkScriptAnalysis.js.map