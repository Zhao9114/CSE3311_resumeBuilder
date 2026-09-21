import type { Resume } from '../types'

/**
 * Shape of a future ATS analysis result.
 * Nothing in iteration 1 calls this — it exists so the UI seam is typed.
 */
export interface AtsResult {
  score: number
  matched: string[]
  missing: string[]
  tips: string[]
}

export interface AtsService {
  analyze(resume: Resume, jobDescription: string): Promise<AtsResult>
}

/**
 * TODO(iteration-2): implement against an LLM call routed through a
 * serverless function. Iteration 1 ships no ATS UI and makes no network
 * requests; this stub only fixes the contract the real service must meet.
 */
export const atsService: AtsService = {
  analyze() {
    return Promise.reject(
      new Error('ATS analysis is not available in iteration 1'),
    )
  },
}
