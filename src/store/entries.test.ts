import { describe, expect, it } from 'vitest'
import { seedResume } from '../data/seed'
import type { ResumeBlock } from '../types'
import { entryFingerprint, entryName, mergeInto, splitIntoEntries } from './entries'
import { insertBlock } from './resumeOps'

const byType = <T extends ResumeBlock['type']>(type: T) =>
  seedResume.blocks.find((b) => b.type === type) as Extract<ResumeBlock, { type: T }>

describe('splitIntoEntries', () => {
  it('splits a section into one-item entries', () => {
    const entries = splitIntoEntries(byType('experience'))
    expect(entries).toHaveLength(2)
    for (const e of entries as ResumeBlock[]) {
      expect(e.type).toBe('experience')
      if (e.type === 'experience') expect(e.data.items).toHaveLength(1)
    }
  })

  it('makes each skill group its own entry and keeps a summary whole', () => {
    expect(splitIntoEntries(byType('skills'))).toHaveLength(3)
    expect(splitIntoEntries(byType('summary'))).toHaveLength(1)
  })

  it('skips empty items and never aliases the source', () => {
    const exp = structuredClone(byType('experience'))
    exp.data.items.push({ role: '', org: '', dates: '', points: [''] })
    const entries = splitIntoEntries(exp) as ResumeBlock[]
    expect(entries).toHaveLength(2)
    if (entries[0].type === 'experience') entries[0].data.items[0].points.push('x')
    expect(exp.data.items[0].points).toHaveLength(3)
  })

  it('names entries for the bank', () => {
    const [first] = splitIntoEntries(byType('experience'))
    expect(entryName(first)).toBe('Software Engineering Intern · Northbridge Labs')
  })
})

describe('entryFingerprint', () => {
  it('ignores case and spacing so duplicates are caught', () => {
    const [a] = splitIntoEntries(byType('projects'))
    const b = structuredClone(a) as ResumeBlock
    if (b.type === 'projects') b.data.items[0].name = '  DRAFTLY '
    expect(entryFingerprint(a)).toBe(entryFingerprint(b))
  })

  it('tells different entries apart', () => {
    const [a, b] = splitIntoEntries(byType('experience'))
    expect(entryFingerprint(a)).not.toBe(entryFingerprint(b))
  })
})

describe('mergeInto / insertBlock with built-in sections', () => {
  const newRole: Omit<ResumeBlock, 'id'> = {
    type: 'experience',
    label: 'Experience',
    enabled: true,
    data: { items: [{ role: 'TA', org: 'UTA', dates: '2025', points: ['Graded labs.'] }] },
  }

  it('appends a saved entry into the existing section instead of adding a second one', () => {
    const next = insertBlock(seedResume, newRole, 0)
    const exp = next.blocks.filter((b) => b.type === 'experience')
    expect(exp).toHaveLength(1)
    expect(next.blocks).toHaveLength(seedResume.blocks.length)
    if (exp[0].type === 'experience') expect(exp[0].data.items.map((i) => i.role)).toContain('TA')
  })

  it('does not duplicate an item the section already has', () => {
    const [existing] = splitIntoEntries(byType('experience'))
    const next = insertBlock(seedResume, existing)
    const exp = next.blocks.find((b) => b.type === 'experience')
    if (exp?.type === 'experience') expect(exp.data.items).toHaveLength(2)
  })

  it('never produces two Skills sections from a saved Skills block', () => {
    const next = insertBlock(seedResume, { ...byType('skills') })
    expect(next.blocks.filter((b) => b.type === 'skills')).toHaveLength(1)
  })

  it('shows a hidden section when an entry is inserted into it', () => {
    const project: Omit<ResumeBlock, 'id'> = {
      type: 'projects', label: 'Projects', enabled: true,
      data: { items: [{ name: 'CLI tool', detail: 'Rust.' }] },
    }
    const next = insertBlock(seedResume, project)
    expect(next.blocks.find((b) => b.type === 'projects')?.enabled).toBe(true)
  })

  it('replaces the summary text', () => {
    const merged = mergeInto(byType('summary'), { type: 'summary', label: 'Summary', enabled: true, data: { text: 'New.' } })
    expect(merged.data.text).toBe('New.')
  })
})
