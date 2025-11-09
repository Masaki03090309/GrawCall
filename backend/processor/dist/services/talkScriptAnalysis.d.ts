export interface HearingItemCoverage {
  covered: boolean
  match_rate: number
}
export interface TalkScriptAnalysisResult {
  should_analyze: boolean
  overall_match_rate?: number
  phase_match_rates?: {
    opening: number
    hearing: number
    proposal: number
    closing: number
  }
  hearing_item_coverage?: {
    [itemName: string]: HearingItemCoverage
  }
}
/**
 * Analyze semantic match rate between talk script and actual call transcript
 * Uses GPT-5-nano for semantic (meaning-based) matching
 */
export declare function analyzeTalkScriptMatch(
  transcript: string,
  projectId: string | null
): Promise<TalkScriptAnalysisResult>
/**
 * Determine causal pattern based on match rates
 * Used for generating causality-aware feedback
 */
export declare function determineCausalPattern(phaseMatchRates: {
  opening: number
  hearing: number
  proposal: number
  closing: number
}): 'hearing_insufficient' | 'proposal_insufficient' | 'closing_insufficient' | 'general'
//# sourceMappingURL=talkScriptAnalysis.d.ts.map
