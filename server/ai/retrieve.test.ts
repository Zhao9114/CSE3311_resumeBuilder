import { describe, expect, it } from 'vitest'
import { seedBank, seedResume } from '../../src/data/seed'
import type { ResumeBlock } from '../../src/types'
import type { Keyword } from './atsScore'
import { assembleTailored, CAPS, rankEntries, reorderPoints, reorderSkills } from './retrieve'

const kw = (term: string, ...aliases: string[]): Keyword => ({ term, aliases })
const bank = seedBank.map((s) => s.block)
const bankBlocks = bank as ResumeBlock[]

const DATA_JOB = { required: [kw('Python'), kw('SQL'), kw('Tableau')], preferred: [kw('pandas')] }
const CLOUD_JOB = { required: [kw('Kubernetes', 'k8s'), kw('Terraform'), kw('AWS')], preferred: [kw('CI/CD')] }

const section = <T extends ResumeBlock['type']>(blocks: ResumeBlock[], type: T) =>
  blocks.find((b) => b.type === type) as Extract<ResumeBlock, { type: T }> | undefined

describe('rankEntries', () => {
  it('ranks by keyword coverage, required keywords weighted above nice-to-haves', () => {
    const ranked = rankEntries(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    const top = ranked.find((r) => r.entry.type === 'experience')!
    expect(top.name).toBe('Data Analyst Intern · Lone Star Health')
    expect(top.source).toBe('bank')
    expect(top.matched).toEqual(expect.arrayContaining(['Python', 'SQL', 'Tableau', 'pandas']))
    expect(top.score).toBe(3 * 3 + 1)
  })

  it('counts an entry that is on the resume and in the bank once, as the resume\'s', () => {
    const ranked = rankEntries(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    const northbridge = ranked.filter((r) => r.name.includes('Northbridge'))
    expect(northbridge).toHaveLength(1)
    expect(northbridge[0].source).toBe('resume')
  })

  it('gives the same output for the same input', () => {
    const a = rankEntries(seedResume, bank, CLOUD_JOB.required, CLOUD_JOB.preferred)
    const b = rankEntries(seedResume, bank, CLOUD_JOB.required, CLOUD_JOB.preferred)
    expect(a.map((r) => r.name)).toEqual(b.map((r) => r.name))
  })
})

describe('assembleTailored', () => {
  it('pulls the most relevant bank entries into the draft', () => {
    const { resume, picks } = assembleTailored(seedResume, bank, CLOUD_JOB.required, CLOUD_JOB.preferred)
    const projects = section(resume.blocks, 'projects')!
    expect(projects.enabled).toBe(true)
    expect(projects.data.items[0].name).toBe('Kubernetes Homelab')
    expect(section(resume.blocks, 'skills')!.data.groups.map((g) => g.name)).toContain('Cloud & DevOps')
    expect(picks.some((p) => p.source === 'bank' && p.name === 'Kubernetes Homelab')).toBe(true)
  })

  it('caps each section and never adds a second section of a type', () => {
    const { resume } = assembleTailored(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    expect(section(resume.blocks, 'experience')!.data.items.length).toBeLessThanOrEqual(CAPS.experience)
    for (const type of ['summary', 'experience', 'skills', 'education', 'projects'] as const) {
      expect(resume.blocks.filter((b) => b.type === type).length).toBeLessThanOrEqual(1)
    }
  })

  it('only ever uses entries from the resume or the bank', () => {
    const known = new Set([...seedResume.blocks, ...bankBlocks].flatMap((b) => (b.type === 'experience' ? b.data.items.map((i) => i.role) : [])))
    const { resume } = assembleTailored(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    for (const item of section(resume.blocks, 'experience')!.data.items) expect(known.has(item.role)).toBe(true)
  })

  it('keeps section ids and order of the live resume', () => {
    const { resume } = assembleTailored(seedResume, bank, CLOUD_JOB.required, CLOUD_JOB.preferred)
    expect(resume.blocks.map((b) => b.id)).toEqual(seedResume.blocks.map((b) => b.id))
    expect(resume.id).toBe(seedResume.id)
  })

  it('lists resume entries the draft leaves out', () => {
    const { left } = assembleTailored(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    expect(left.every((l) => l.section !== 'summary')).toBe(true)
  })

  it('does not change its input', () => {
    const before = structuredClone(seedResume)
    assembleTailored(seedResume, bank, DATA_JOB.required, DATA_JOB.preferred)
    expect(seedResume).toEqual(before)
  })
})

describe('reordering inside entries', () => {
  it('moves bullets that cover a keyword to the top, keeping ties in order', () => {
    const points = ['Led a team.', 'Wrote SQL reports.', 'Mentored juniors.', 'Built Python and SQL jobs.']
    expect(reorderPoints(points, [kw('Python'), kw('SQL')], [])).toEqual([
      'Built Python and SQL jobs.', 'Wrote SQL reports.', 'Led a team.', 'Mentored juniors.',
    ])
  })

  it('moves wanted skills to the front of their group', () => {
    expect(reorderSkills({ name: 'Tools', items: 'Git, Docker, Postgres' }, [kw('PostgreSQL', 'Postgres')], []).items)
      .toBe('Postgres, Git, Docker')
  })
})
