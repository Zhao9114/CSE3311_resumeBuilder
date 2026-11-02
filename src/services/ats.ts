import type { Resume } from '../types'
import { postAi } from './aiClient'

export type AtsVerdict = 'Strong match' | 'Fair match' | 'Weak match'

export interface AtsTip {
  text: string
  /** The resume section the tip is about; empty for general advice. */
  section: string
}

/**
 * Result of an ATS check. The model only lists what the posting asks for;
 * `matched`, `missing` and `score` are computed by plain code on the server
 * (server/ai/atsScore.ts), so the same inputs always give the same score.
 */
export interface AtsResult {
  score: number
  verdict: AtsVerdict
  matched: string[]
  missing: string[]
  requiredMissing: string[]
  preferredMissing: string[]
  tips: AtsTip[]
  postingTitle: string
}

export interface AtsService {
  analyze(resume: Resume, jobDescription: string): Promise<AtsResult>
}

/** Shown when the AI can't be reached, clearly labelled as sample output. */
export const SAMPLE_ATS_RESULT: AtsResult = {
  score: 78,
  verdict: 'Strong match',
  matched: ['React', 'TypeScript', 'REST', 'PostgreSQL', 'testing', 'accessibility'],
  missing: ['CI/CD', 'Kubernetes', 'GraphQL'],
  requiredMissing: ['CI/CD'],
  preferredMissing: ['Kubernetes', 'GraphQL'],
  tips: [
    { text: 'Add a metric to the CMS bullet — accessibility scores or page count moved.', section: 'Experience' },
    { text: 'The posting asks for CI/CD; if you have used GitHub Actions, name it.', section: 'Skills' },
    { text: 'Lead each experience bullet with a past-tense action verb.', section: 'Experience' },
  ],
  postingTitle: '',
}

/**
 * Identical checks are answered from this tab's session storage, so
 * re-running the same resume against the same posting costs nothing.
 */
async function cacheKey(resume: Resume, jobDescription: string): Promise<string> {
  const content = JSON.stringify([resume.profile, resume.blocks, jobDescription.trim()])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `draftly:ats:${hex}`
}

function readCache(key: string): AtsResult | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as AtsResult) : null
  } catch {
    return null
  }
}

function writeCache(key: string, result: AtsResult): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(result))
  } catch {
    // Storage full or blocked: the result is still shown, just not cached.
  }
}

export const atsService: AtsService = {
  async analyze(resume, jobDescription) {
    const key = await cacheKey(resume, jobDescription)
    const cached = readCache(key)
    if (cached) return cached
    const result = await postAi<AtsResult>('/api/ats', { resume, jobDescription })
    writeCache(key, result)
    return result
  },
}
