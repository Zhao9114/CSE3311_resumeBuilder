import { z } from 'zod'
import { MAX_JOB_DESCRIPTION, MIN_JOB_DESCRIPTION } from '../../src/ai/limits.js'
import { resumeToText } from '../../src/ai/resumeText.js'
import { parseResume } from '../../src/store/normalize.js'
import { scoreResume } from '../ai/atsScore.js'
import { DATA_NOT_INSTRUCTIONS, fence, NO_INVENTION } from '../ai/prompting.js'
import type { AiDeps } from '../deps.js'
import { json, readBody } from '../http.js'
import { guarded, modelFailure } from './guard.js'

const AtsRequest = z.object({
  resume: z.unknown(),
  jobDescription: z
    .string()
    .trim()
    .min(MIN_JOB_DESCRIPTION, 'Paste a longer job description.')
    .max(MAX_JOB_DESCRIPTION, `Job description is limited to ${MAX_JOB_DESCRIPTION} characters.`),
})

const KeywordSchema = z.object({
  term: z.string().describe('Short canonical name, e.g. "PostgreSQL", "CI/CD", "React".'),
  aliases: z.array(z.string()).describe('Other spellings of the same thing a resume might use.'),
})

/** What the model returns. Matching and scoring are not part of it. */
export const AtsModelOutput = z.object({
  postingTitle: z.string(),
  seniority: z.enum(['intern', 'entry', 'mid', 'senior', 'unknown']),
  required: z.array(KeywordSchema),
  preferred: z.array(KeywordSchema),
  tips: z.array(
    z.object({
      text: z.string(),
      section: z.string().describe('Resume section the tip is about, or "" if general.'),
    }),
  ),
})

const SYSTEM = [
  'You are the applicant-tracking-system (ATS) analyst inside Draftly, a resume builder.',
  DATA_NOT_INSTRUCTIONS,
  '',
  'From the job posting, list:',
  '- postingTitle: the job title ("" if none is given).',
  '- seniority: intern, entry, mid, senior, or unknown.',
  '- required: up to 15 hard requirements — skills, languages, tools, platforms, certifications, ' +
    'degrees. Use the short canonical name. For each, give aliases: other spellings of the same ' +
    'thing (e.g. PostgreSQL → Postgres), never merely related skills.',
  '- When the posting accepts alternatives ("Jest or Vitest", "AWS/GCP"), list them as ONE keyword ' +
    'with the others as aliases — having any one of them meets the requirement.',
  '- preferred: up to 10 nice-to-haves in the same format, not repeating required ones.',
  'Leave out generic soft skills (communication, teamwork) unless the posting stresses them.',
  '',
  'Then give 3 to 5 tips that would raise this resume\'s match for this posting. Each tip must point ' +
    'at specific text already on the resume, or at a keyword the posting asks for that the resume ' +
    'lacks — and in that case tell the user to add it only if they genuinely have that experience.',
  NO_INVENTION,
  'Do not judge whether the resume contains a keyword; that is checked separately.',
].join('\n')

export async function handleAts(request: Request, deps: AiDeps): Promise<Response> {
  const body = await readBody(request, AtsRequest)
  if (!body.ok) return body.response

  // Re-parse rather than trust the browser: unknown fields drop out and a
  // malformed block can't reach the prompt.
  const resume = parseResume(body.data.resume)
  const resumeText = resumeToText(resume)

  return guarded(request, deps, 'ats', async ({ model, charge }) => {
    const result = await model.generate({
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `${fence('resume', resumeText)}\n\n${fence('job_posting', body.data.jobDescription)}`,
        },
      ],
      schema: AtsModelOutput,
      maxTokens: 2000,
      effort: 'low',
    })
    charge(result.usage)
    if (!result.ok) return modelFailure(result.reason)

    const { postingTitle, seniority, required, preferred, tips } = result.data
    const score = scoreResume(resumeText, required.slice(0, 15), preferred.slice(0, 10))
    return json({
      ...score,
      postingTitle,
      seniority,
      tips: tips
        .filter((t) => t.text.trim() !== '')
        .slice(0, 5)
        .map((t) => ({ text: t.text.trim(), section: t.section.trim() })),
    })
  })
}
