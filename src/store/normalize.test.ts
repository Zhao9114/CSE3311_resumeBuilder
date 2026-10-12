import { describe, it, expect } from 'vitest'
import {
  normalizeApplication,
  normalizeDateText,
  normalizeIsoDate,
  normalizeResume,
  parseBlock,
  parseResume,
} from './normalize'
import { seedResume } from '../data/seed'
import type { Resume } from '../types'

/**
 * Data cleaning (IT1 risk table: "messy resume input like inconsistent
 * dates breaks the preview or parsing"). Normalizing happens on save;
 * parsing guards every read.
 */

describe('normalizeDateText', () => {
  it.each([
    ['05/2027', 'May 2027'],
    ['2027-05', 'May 2027'],
    ['2024 - current', '2024 – Present'],
    ['2024-present', '2024 – Present'],
    ['jan 2023 to now', 'Jan 2023 – Present'],
    ['summer 2025', 'Summer 2025'],
    ['  expected   may 2027 ', 'Expected May 2027'],
    ['2024 — 2025', '2024 – 2025'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeDateText(input)).toBe(expected)
  })

  it('leaves already-clean dates alone, so normalizing twice changes nothing', () => {
    for (const clean of ['Summer 2025', '2024 – Present', 'Expected May 2027']) {
      expect(normalizeDateText(clean)).toBe(clean)
      expect(normalizeDateText(normalizeDateText(clean))).toBe(clean)
    }
  })

  it('does not invent a month from an impossible number', () => {
    expect(normalizeDateText('13/2027')).toBe('13/2027')
  })
})

describe('normalizeIsoDate', () => {
  it('keeps a valid yyyy-mm-dd and rejects impossible calendar dates', () => {
    const today = new Date('2026-10-12T12:00:00')
    expect(normalizeIsoDate('2026-08-14', today)).toBe('2026-08-14')
    expect(normalizeIsoDate('2026-02-31', today)).not.toBe('2026-02-31')
    expect(normalizeIsoDate('', today)).toBe('2026-10-12')
  })
})

describe('normalizeResume', () => {
  it('trims text, drops empty bullets, and normalizes dates — without mutating its input', () => {
    const messy: Resume = structuredClone(seedResume)
    messy.title = '  General SWE  '
    messy.profile.name = '  Jordan  '
    const exp = messy.blocks.find((b) => b.type === 'experience')!
    if (exp.type !== 'experience') throw new Error('seed changed')
    exp.data.items[0].dates = 'summer 2025 - current'
    exp.data.items[0].points = ['  Built things.  ', '', '   ']
    const before = structuredClone(messy)

    const clean = normalizeResume(messy)
    const cleanExp = clean.blocks.find((b) => b.type === 'experience')!
    if (cleanExp.type !== 'experience') throw new Error('type lost')

    expect(clean.title).toBe('General SWE')
    expect(clean.profile.name).toBe('Jordan')
    expect(cleanExp.data.items[0].dates).toBe('Summer 2025 – Present')
    expect(cleanExp.data.items[0].points).toEqual(['Built things.'])
    expect(clean.blocks.map((b) => b.id)).toEqual(messy.blocks.map((b) => b.id)) // order kept
    expect(messy).toEqual(before)
  })
})

describe('normalizeApplication', () => {
  it('drops a custom label when the status is not Custom, and an empty one when it is', () => {
    const base = { employer: ' Acme ', role: ' Dev ', versionId: 'v1', appliedAt: '2026-01-01' }
    const notCustom = normalizeApplication({ ...base, status: 'Applied', customStatus: 'stale' })
    expect(notCustom.customStatus).toBeUndefined()
    expect(notCustom.employer).toBe('Acme')

    const emptyCustom = normalizeApplication({ ...base, status: 'Custom', customStatus: '   ' })
    expect(emptyCustom.customStatus).toBeUndefined()
  })
})

describe('parseResume / parseBlock (reading untrusted rows)', () => {
  it('fills safe defaults for a malformed row instead of throwing', () => {
    const parsed = parseResume({ templateId: 'neon', profile: null, blocks: 'oops' }, 'r9')
    expect(parsed).toEqual({
      id: 'r9',
      title: 'My resume',
      templateId: 'classic',
      profile: { name: '', title: '', email: '', phone: '', location: '', links: '' },
      blocks: [],
    })
  })

  it('drops unknown block types but keeps the good ones in order', () => {
    const parsed = parseResume({
      blocks: [
        { id: 'a', type: 'summary', label: 'Summary', enabled: true, data: { text: 'hi' } },
        { id: 'b', type: 'hobbies', data: {} },
        { id: 'c', type: 'skills', data: { groups: [{ name: 'Langs', items: 'TS' }, 42] } },
      ],
    })
    expect(parsed.blocks.map((b) => b.id)).toEqual(['a', 'c'])
    const skills = parsed.blocks[1]
    expect(skills.type === 'skills' && skills.data.groups).toEqual([{ name: 'Langs', items: 'TS' }])
    expect(skills.enabled).toBe(true) // missing flag defaults to shown
  })

  it('coerces bad field types inside a block', () => {
    const block = parseBlock({
      id: 'x',
      type: 'experience',
      data: { items: [{ role: 5, org: 'Org', points: ['ok', null, 3] }] },
    })
    expect(block?.type === 'experience' && block.data.items[0]).toEqual({
      role: '',
      org: 'Org',
      dates: '',
      points: ['ok'],
    })
  })
})
