import { describe, expect, it } from 'vitest'
import { buildIndex, keywordFound, scoreResume, verdictFor, type Keyword } from './atsScore'

const kw = (term: string, ...aliases: string[]): Keyword => ({ term, aliases })

describe('keywordFound', () => {
  const found = (resume: string, keyword: Keyword) => keywordFound(buildIndex(resume), keyword)

  it('ignores case and punctuation', () => {
    expect(found('Built APIs in TYPESCRIPT.', kw('TypeScript'))).toBe(true)
    expect(found('Shipped with CI/CD pipelines', kw('CI/CD'))).toBe(true)
    expect(found('Set up CICD', kw('CI/CD'))).toBe(true)
  })

  it('matches dotted and joined spellings', () => {
    expect(found('Node.js services', kw('NodeJS'))).toBe(true)
    expect(found('nodejs services', kw('Node.js'))).toBe(true)
  })

  it('uses the built-in alias table and the model-supplied aliases', () => {
    expect(found('Postgres and Redis', kw('PostgreSQL'))).toBe(true)
    expect(found('Deployed on k8s', kw('Kubernetes'))).toBe(true)
    expect(found('Wrote Terraform modules', kw('Infrastructure as code', 'Terraform'))).toBe(true)
  })

  it('treats singular and plural as one keyword', () => {
    expect(found('Designed REST APIs', kw('API'))).toBe(true)
    expect(found('Designed an API', kw('APIs'))).toBe(true)
  })

  it('needs whole words', () => {
    expect(found('JavaScript developer', kw('Java'))).toBe(false)
    expect(found('Reactive programming', kw('React'))).toBe(false)
  })

  it('matches multi-word phrases only in order', () => {
    expect(found('applied machine learning to churn', kw('Machine learning'))).toBe(true)
    expect(found('learning about machines', kw('Machine learning'))).toBe(false)
  })
})

describe('scoreResume', () => {
  const resume = 'Software intern. Built React and TypeScript apps with PostgreSQL. Wrote unit tests.'

  it('weights required keywords three times as much as preferred ones', () => {
    const result = scoreResume(
      resume,
      [kw('React'), kw('TypeScript'), kw('PostgreSQL'), kw('Kubernetes')],
      [kw('GraphQL'), kw('unit tests')],
    )
    // 0.75 × 3/4 + 0.25 × 1/2
    expect(result.score).toBe(69)
    expect(result.verdict).toBe('Fair match')
    expect(result.matched).toEqual(['React', 'TypeScript', 'PostgreSQL', 'unit tests'])
    expect(result.requiredMissing).toEqual(['Kubernetes'])
    expect(result.preferredMissing).toEqual(['GraphQL'])
    expect(result.missing).toEqual(['Kubernetes', 'GraphQL'])
  })

  it('scores on whichever list is present when the other is empty', () => {
    expect(scoreResume(resume, [kw('React'), kw('Go lang')], []).score).toBe(50)
    expect(scoreResume(resume, [], [kw('React')]).score).toBe(100)
    expect(scoreResume(resume, [], []).score).toBe(0)
  })

  it('dedupes keywords and drops preferred ones already required', () => {
    const result = scoreResume(resume, [kw('React'), kw('react')], [kw('REACT'), kw('Docker')])
    expect(result.matched).toEqual(['React'])
    expect(result.missing).toEqual(['Docker'])
  })

  it('is repeatable', () => {
    const a = scoreResume(resume, [kw('React'), kw('Rust')], [kw('SQL')])
    const b = scoreResume(resume, [kw('React'), kw('Rust')], [kw('SQL')])
    expect(a).toEqual(b)
  })
})

describe('verdictFor', () => {
  it.each([
    [100, 'Strong match'],
    [75, 'Strong match'],
    [74, 'Fair match'],
    [50, 'Fair match'],
    [49, 'Weak match'],
    [0, 'Weak match'],
  ])('%i → %s', (score, verdict) => {
    expect(verdictFor(score)).toBe(verdict)
  })
})
