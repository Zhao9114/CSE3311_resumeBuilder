import { z } from 'zod'
import { MAX_BANK_ENTRIES } from '../../src/ai/limits.js'
import { resumeToText } from '../../src/ai/resumeText.js'
import type { BlockDraft } from '../../src/store/entries.js'
import { parseBlock, parseResume } from '../../src/store/normalize.js'
import type { Resume } from '../../src/types/index.js'
import { buildIndex, keywordFound, scoreResume, type Keyword } from '../ai/atsScore.js'
import { DATA_NOT_INSTRUCTIONS, fence, NO_INVENTION } from '../ai/prompting.js'
import { assembleTailored, type TailoredDraft } from '../ai/retrieve.js'
import type { AiDeps } from '../deps.js'
import { json, readBody } from '../http.js'
import { guarded } from './guard.js'

const Term = z.string().trim().min(1).max(60)
const KeywordIn = z.object({ term: Term, aliases: z.array(Term).max(8).default([]) })

/**
 * The keywords come from the browser's earlier ATS check rather than a second
 * extraction call. Trusting them is safe: they only steer the caller's own
 * resume, and they are capped and length-limited like any other input.
 */
const TailorRequest = z.object({
  resume: z.unknown(),
  bank: z.array(z.unknown()).max(MAX_BANK_ENTRIES).default([]),
  postingTitle: z.string().trim().max(120).default(''),
  keywords: z.object({
    required: z.array(KeywordIn).max(15),
    preferred: z.array(KeywordIn).max(10).default([]),
  }),
})

const SummaryOutput = z.object({
  summary: z.string().describe('2-3 sentence professional summary, or "" if the resume gives too little to write one.'),
})

const SYSTEM = [
  'You write the professional summary for a resume inside Draftly, a resume builder.',
  DATA_NOT_INSTRUCTIONS,
  NO_INVENTION,
  '',
  'The <resume> has already been tailored to the job in <job_posting>: its entries were chosen for it.',
  'Write a 2-3 sentence summary of this candidate aimed at that job, using only facts in <resume>.',
  'Where the resume genuinely supports them, mention the keywords listed in <matched_keywords>.',
  'Never mention a skill, tool or qualification that is not in <resume>.',
  'No first person ("I"), no markdown, no placeholders, no buzzword lists.',
].join('\n')

export type SummarySource = 'model' | 'original'

export interface TailorResponse extends TailoredDraft {
  scoreBefore: number
  scoreAfter: number
  summarySource: SummarySource
  /** Why the summary was not rewritten, when it was not. */
  notice: string | null
}

/**
 * The deterministic check on the one thing the model writes: a summary that
 * names a posting keyword the tailored resume does not contain is rejected,
 * whatever the prompt said. Returns the offending terms.
 */
export function inventedKeywords(summary: string, body: string, keywords: Keyword[]): string[] {
  const inSummary = buildIndex(summary)
  const inBody = buildIndex(body)
  return keywords.filter((k) => keywordFound(inSummary, k) && !keywordFound(inBody, k)).map((k) => k.term)
}

function withSummary(resume: Resume, text: string): Resume {
  return {
    ...resume,
    blocks: resume.blocks.map((b) => (b.type === 'summary' ? { ...b, data: { text } } : b)),
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    return body.message ?? 'The AI is unavailable right now.'
  } catch {
    return 'The AI is unavailable right now.'
  }
}

/**
 * POST /api/tailor — retrieval-augmented tailoring.
 *
 *  1. Validate, and re-parse the resume and every bank entry (a malformed one
 *     drops out instead of reaching the prompt).
 *  2. Retrieve: rank all entries against the posting's keywords and assemble
 *     the draft, in code. Free, and works even when the AI is off.
 *  3. Generate: one capped Haiku call writes a summary from only the chosen
 *     entries. If it names a keyword the draft lacks, it is discarded.
 *  4. Score the draft the same way the ATS check does.
 *
 * If step 3 is unavailable (no key, over the limit, budget spent, model
 * error), the draft still comes back with the original summary and a notice.
 */
export async function handleTailor(request: Request, deps: AiDeps): Promise<Response> {
  const body = await readBody(request, TailorRequest)
  if (!body.ok) return body.response

  const resume = parseResume(body.data.resume)
  const bank: BlockDraft[] = body.data.bank.flatMap((raw) => {
    const block = parseBlock((raw as { block?: unknown })?.block ?? raw)
    if (!block) return []
    const { id: _id, ...draft } = block
    return [draft]
  })
  const { required, preferred } = body.data.keywords
  const keywords = [...required, ...preferred]

  const draft = assembleTailored(resume, bank, required, preferred)
  const scoreBefore = scoreResume(resumeToText(resume), required, preferred).score
  const done = (out: Resume, summarySource: SummarySource, notice: string | null) =>
    json({
      ...draft,
      resume: out,
      scoreBefore,
      scoreAfter: scoreResume(resumeToText(out), required, preferred).score,
      summarySource,
      notice,
    } satisfies TailorResponse)

  const hasSummary = draft.resume.blocks.some((b) => b.type === 'summary')
  if (!hasSummary) return done(draft.resume, 'original', null)
  if (!deps.model) return done(draft.resume, 'original', 'AI is off, so the summary was left as it was.')

  const bodyText = resumeToText({
    ...draft.resume,
    blocks: draft.resume.blocks.filter((b) => b.type !== 'summary'),
  })
  const matched = [...new Set(draft.picks.flatMap((p) => p.matched))]

  let written: string | null = null
  let notice: string | null = null
  const response = await guarded(request, deps, 'tailor', async ({ model, charge }) => {
    const result = await model.generate({
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            fence('resume', bodyText),
            fence('job_posting', body.data.postingTitle || 'Not given'),
            fence('matched_keywords', matched.join(', ') || 'none'),
          ].join('\n\n'),
        },
      ],
      schema: SummaryOutput,
      maxTokens: 400,
      effort: 'low',
    })
    charge(result.usage)
    if (!result.ok) {
      notice = 'The AI could not write a summary this time, so it was left as it was.'
      return json({ ok: false })
    }
    const text = result.data.summary.trim()
    const invented = inventedKeywords(text, bodyText, keywords)
    if (!text) notice = 'There was too little on the resume to write a new summary.'
    else if (invented.length > 0) {
      notice = `The AI's summary mentioned ${invented.join(', ')}, which is not on the resume, so it was discarded.`
    } else written = text
    return json({ ok: true })
  })

  if (!response.ok && !notice) notice = `${await errorMessage(response)} The summary was left as it was.`
  return written
    ? done(withSummary(draft.resume, written), 'model', null)
    : done(draft.resume, 'original', notice)
}
