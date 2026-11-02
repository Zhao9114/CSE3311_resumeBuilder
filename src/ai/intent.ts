import type { SectionType } from '../types'

/**
 * The intent parser: the first stage of the assistant pipeline.
 *
 * Every chat message is sorted into one of these intents before any model
 * writes anything. The intent picks the prompt, the output schema and the
 * section the reply is allowed to touch, so a request to "rewrite my bullets"
 * can only ever come back as new bullets for an existing experience block.
 *
 * Rules run first and cost nothing. Only a message the rules can't place
 * with confidence goes to the model (see server/handlers/assistant.ts), and
 * an off-topic message never reaches the model at all. In iteration 4 this
 * same routing decides when to retrieve past postings.
 *
 * This file is shared by the browser and the serverless functions, so it
 * holds no value imports — only types, which compile away.
 */

export type Intent =
  | 'write_summary'
  | 'draft_experience'
  | 'rewrite_bullets'
  | 'add_skills'
  | 'tailor_to_job'
  | 'general_advice'
  | 'off_topic'

export const INTENTS: Intent[] = [
  'write_summary',
  'draft_experience',
  'rewrite_bullets',
  'add_skills',
  'tailor_to_job',
  'general_advice',
  'off_topic',
]

export const INTENT_LABELS: Record<Intent, string> = {
  write_summary: 'Write summary',
  draft_experience: 'Draft experience',
  rewrite_bullets: 'Rewrite bullets',
  add_skills: 'Add skills',
  tailor_to_job: 'Tailor to job',
  general_advice: 'Advice',
  off_topic: 'Off topic',
}

/** The section each intent writes to, if it writes to one. */
export const INTENT_SECTION: Record<Intent, SectionType | null> = {
  write_summary: 'summary',
  draft_experience: 'experience',
  rewrite_bullets: 'experience',
  add_skills: 'skills',
  tailor_to_job: null,
  general_advice: null,
  off_topic: null,
}

export interface ParsedIntent {
  intent: Intent
  /** 0–1. Below RULES_CONFIDENCE_THRESHOLD the server asks the model instead. */
  confidence: number
  /** Skill and tool names mentioned in the message, e.g. for add_skills. */
  skills: string[]
  source: 'rules' | 'model'
}

export const RULES_CONFIDENCE_THRESHOLD = 0.7

/**
 * A message this long is almost certainly a pasted job posting, which only
 * makes sense as a tailoring request.
 */
const PASTED_POSTING_LENGTH = 600

type Rule = [RegExp, number]

const RULES: Record<Exclude<Intent, 'off_topic' | 'general_advice'>, Rule[]> = {
  write_summary: [
    // Weighted above draft_experience's "write … internship" so "write a
    // summary for a backend internship" lands here.
    [/\bsummary\b/, 3],
    [/\b(about me|objective|profile statement|personal statement|elevator pitch|bio)\b/, 2],
    [/\bintro(duction)?\b/, 1],
  ],
  draft_experience: [
    [/\b(draft|write|add|create|generate|make)\b.*\b(experience|job|role|internship|position)\b/, 2],
    [/\b(i (worked|interned|was an?)|my (job|internship|role) (at|as))\b/, 2],
    [/\bexperience (block|entry|section)\b/, 1],
  ],
  rewrite_bullets: [
    [/\bbullets?\b|\bbullet points?\b/, 2],
    [/\b(rewrite|reword|rephrase|polish|tighten|strengthen)\b/, 1],
    [/\b(action verbs?|quantif\w*|metrics?|impact)\b/, 1],
  ],
  add_skills: [
    [/\bskills?\b/, 2],
    [/\b(tech stack|technologies|tools|languages|frameworks)\b/, 1],
  ],
  tailor_to_job: [
    [/\b(tailor|customi[sz]e|target|align)\b/, 2],
    [/\b(job description|job posting|posting|this (job|role|position)|the (job|role|position))\b/, 2],
    [/\b(match|fit)\b.*\b(job|role|posting)\b/, 1],
  ],
}

/** Words that show a message is about a resume or a job search at all. */
const DOMAIN =
  /\b(resume|cv|summary|experience|bullets?|skills?|job|role|intern(ship)?|projects?|education|degree|gpa|career|recruiter|ats|posting|application|interview|employer|hiring|section|cover letter)\b/

/**
 * Clearly off-topic requests, and the usual prompt-injection openers. The
 * latter are refused here so they never reach a model.
 */
const OFF_TOPIC =
  /\b(poem|joke|recipe|weather|song|lyrics|story|horoscope|homework|translate|stock price)\b|\bignore (all |the |any )?(previous|prior|above)\b|\bsystem prompt\b|\byou are now\b|\bpretend (to be|you are)\b|\bjailbreak\b/

/** Common tools and languages, so add_skills can name them back. */
const KNOWN_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST',
  'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
  'HTML', 'CSS', 'Tailwind', 'Figma',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Linux', 'Git', 'CI/CD', 'GitHub Actions',
  'Supabase', 'Firebase', 'Vercel',
  'Pandas', 'NumPy', 'PyTorch', 'TensorFlow', 'scikit-learn', 'Excel', 'Tableau',
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const SKILL_PATTERNS = KNOWN_SKILLS.map((name) => ({
  name,
  // Word boundaries don't work around "C++" or "Node.js", so match on
  // "not a letter or digit" either side instead.
  re: new RegExp(`(^|[^a-z0-9])${escapeRegExp(name.toLowerCase())}(?![a-z0-9])`),
}))

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  return SKILL_PATTERNS.filter((s) => s.re.test(lower)).map((s) => s.name)
}

/**
 * Classifies a message with keyword rules alone. Confidence is high only
 * when one intent clearly wins; ties and weak matches come back below the
 * threshold so the server can ask the model.
 */
export function classifyByRules(message: string): ParsedIntent {
  const text = message.toLowerCase()
  const skills = extractSkills(message)

  if (OFF_TOPIC.test(text) && !DOMAIN.test(text)) {
    return { intent: 'off_topic', confidence: 0.95, skills, source: 'rules' }
  }
  // An injection attempt wrapped in resume words is still refused.
  if (/\bignore (all |the |any )?(previous|prior|above)\b|\bsystem prompt\b/.test(text)) {
    return { intent: 'off_topic', confidence: 0.9, skills, source: 'rules' }
  }

  if (message.length >= PASTED_POSTING_LENGTH) {
    return { intent: 'tailor_to_job', confidence: 0.8, skills, source: 'rules' }
  }

  const scores = (Object.keys(RULES) as (keyof typeof RULES)[])
    .map((intent) => ({
      intent,
      score: RULES[intent].reduce((sum, [re, weight]) => sum + (re.test(text) ? weight : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)

  const [top, second] = scores
  if (top.score === 0) {
    // Nothing matched. A resume-flavoured question is probably advice; a
    // message with no resume words at all is left for the model to judge.
    return DOMAIN.test(text)
      ? { intent: 'general_advice', confidence: 0.7, skills, source: 'rules' }
      : { intent: 'general_advice', confidence: 0.3, skills, source: 'rules' }
  }

  const gap = top.score - second.score
  const confidence = gap >= 2 ? 0.9 : gap === 1 && top.score >= 2 ? 0.75 : 0.5
  return { intent: top.intent, confidence, skills, source: 'rules' }
}
