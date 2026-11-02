/**
 * The deterministic half of the ATS check.
 *
 * The model only reads the posting and lists the keywords it asks for. Whether
 * each keyword is on the resume, and the score that follows, is decided here
 * in plain code — so the same resume and posting always get the same score,
 * the model can't claim a match that isn't there, and the logic is testable.
 */

export interface Keyword {
  term: string
  aliases: string[]
}

export type AtsVerdict = 'Strong match' | 'Fair match' | 'Weak match'

export interface AtsScore {
  score: number
  verdict: AtsVerdict
  matched: string[]
  missing: string[]
  requiredMissing: string[]
  preferredMissing: string[]
}

/**
 * Spellings recruiters' systems treat as one skill. The model supplies
 * aliases too; these cover the common ones even when it doesn't.
 */
const BUILT_IN_ALIASES: string[][] = [
  ['postgresql', 'postgres', 'psql'],
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['kubernetes', 'k8s'],
  // Not bare "go": it's an ordinary English word and would match almost any resume.
  ['golang', 'go lang'],
  ['react', 'react.js', 'reactjs'],
  ['node.js', 'node', 'nodejs'],
  ['ci/cd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  ['aws', 'amazon web services'],
  ['gcp', 'google cloud', 'google cloud platform'],
  ['machine learning', 'ml'],
  ['rest', 'restful', 'rest api', 'rest apis'],
  ['c#', 'csharp', '.net'],
]

const MAX_GRAM = 4

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/** "APIs" and "API" are the same keyword; short words like "aws" are left alone. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
}

/**
 * Every run of 1–4 consecutive words, joined both with and without spaces,
 * so "Node.js", "node js" and "NodeJS" all find each other, as do "CI/CD"
 * and "CICD".
 */
export function buildIndex(text: string): Set<string> {
  const words = tokens(text)
  const index = new Set<string>()
  for (let n = 1; n <= MAX_GRAM; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n)
      const last = gram.length - 1
      const singularGram = [...gram.slice(0, last), singular(gram[last])]
      for (const g of [gram, singularGram]) {
        index.add(g.join(' '))
        index.add(g.join(''))
      }
    }
  }
  return index
}

function phraseFound(index: Set<string>, phrase: string): boolean {
  const words = tokens(phrase)
  if (words.length === 0 || words.length > MAX_GRAM) return false
  const last = words.length - 1
  const forms = [words, [...words.slice(0, last), singular(words[last])]]
  return forms.some((w) => index.has(w.join(' ')) || index.has(w.join('')))
}

function spellings(keyword: Keyword): string[] {
  const all = [keyword.term, ...keyword.aliases]
  const lower = all.map((s) => s.toLowerCase())
  for (const group of BUILT_IN_ALIASES) {
    if (group.some((g) => lower.includes(g))) all.push(...group)
  }
  return all
}

export function keywordFound(index: Set<string>, keyword: Keyword): boolean {
  return spellings(keyword).some((s) => phraseFound(index, s))
}

/** Case-insensitive dedupe that keeps the first spelling seen. */
function dedupe(keywords: Keyword[]): Keyword[] {
  const seen = new Set<string>()
  return keywords.filter((k) => {
    const key = k.term.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function verdictFor(score: number): AtsVerdict {
  if (score >= 75) return 'Strong match'
  if (score >= 50) return 'Fair match'
  return 'Weak match'
}

/**
 * Required keywords carry three quarters of the score and preferred ones a
 * quarter. With only one kind present, that kind is the whole score.
 */
export function scoreResume(resumeText: string, required: Keyword[], preferred: Keyword[]): AtsScore {
  const index = buildIndex(resumeText)
  const req = dedupe(required)
  const reqTerms = new Set(req.map((k) => k.term.toLowerCase()))
  const pref = dedupe(preferred).filter((k) => !reqTerms.has(k.term.toLowerCase()))

  const reqHit = req.filter((k) => keywordFound(index, k))
  const prefHit = pref.filter((k) => keywordFound(index, k))
  const requiredMissing = req.filter((k) => !reqHit.includes(k)).map((k) => k.term)
  const preferredMissing = pref.filter((k) => !prefHit.includes(k)).map((k) => k.term)

  let ratio: number
  if (req.length && pref.length) {
    ratio = 0.75 * (reqHit.length / req.length) + 0.25 * (prefHit.length / pref.length)
  } else if (req.length) {
    ratio = reqHit.length / req.length
  } else if (pref.length) {
    ratio = prefHit.length / pref.length
  } else {
    ratio = 0
  }
  const score = Math.round(100 * ratio)

  return {
    score,
    verdict: verdictFor(score),
    matched: [...reqHit, ...prefHit].map((k) => k.term),
    missing: [...requiredMissing, ...preferredMissing],
    requiredMissing,
    preferredMissing,
  }
}
