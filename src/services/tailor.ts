import type { BuiltInSectionType, Resume, SavedBlock } from '../types'
import { MAX_BANK_ENTRIES } from '../ai/limits'
import { postAi } from './aiClient'
import type { AtsResult } from './ats'

export interface TailorPick {
  section: BuiltInSectionType
  name: string
  source: 'resume' | 'bank'
  score: number
  /** The posting's keywords this entry covers. */
  matched: string[]
}

/**
 * A tailored draft. The entries were chosen by plain code on the server
 * (server/ai/retrieve.ts) from the resume and the block bank; the model only
 * rewrote the summary, and only when `summarySource` is 'model'.
 */
export interface TailorResult {
  resume: Resume
  picks: TailorPick[]
  left: { section: BuiltInSectionType; name: string }[]
  scoreBefore: number
  scoreAfter: number
  summarySource: 'model' | 'original'
  notice: string | null
}

/** True when an ATS result carries the keywords tailoring needs. */
export function canTailor(result: AtsResult | null): result is AtsResult & Required<Pick<AtsResult, 'keywords'>> {
  return !!result?.keywords && result.keywords.required.length + result.keywords.preferred.length > 0
}

export const tailorService = {
  build(resume: Resume, bank: SavedBlock[], ats: AtsResult & Required<Pick<AtsResult, 'keywords'>>): Promise<TailorResult> {
    return postAi<TailorResult>('/api/tailor', {
      resume,
      // Only the blocks; names and tags stay in the browser.
      bank: bank.slice(0, MAX_BANK_ENTRIES).map((s) => s.block),
      postingTitle: ats.postingTitle,
      keywords: ats.keywords,
    })
  },
}
