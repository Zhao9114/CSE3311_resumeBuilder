import type {
  ApplicationDraft,
  Profile,
  Resume,
  ResumeBlock,
  SectionType,
  TemplateId,
} from '../types'
import { APPLICATION_STATUSES, DEFAULT_TEMPLATE, SECTION_LABELS, SECTION_TYPES, TEMPLATES } from '../types'
import { nextId } from './resumeOps'

/**
 * Two jobs, both at the persistence boundary:
 *
 * - `normalize*` cleans data on its way *into* storage: trims text, drops
 *   empty bullets, and rewrites dates into one style. It is never run while
 *   the user is typing — trimming as you type would eat the space you just
 *   pressed — only when a row is written.
 * - `parse*` checks data on its way *out* of storage. A row edited by hand
 *   in the dashboard, or written by an older build, gets safe defaults
 *   instead of crashing the preview.
 */

// ─── Dates ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CAPITALIZE = new RegExp(
  '\\b(' +
    [
      'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
      'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
      'spring', 'summer', 'fall', 'autumn', 'winter', 'expected',
    ].join('|') +
    ')\\b',
  'gi',
)

function monthName(month: number): string | null {
  return month >= 1 && month <= 12 ? MONTHS[month - 1] : null
}

/**
 * Brings the free-text date fields on experience and education into one
 * style, so a resume typed over several sittings doesn't show "05/2024 -
 * current" next to "Jan 2023 – Present".
 *
 *   "05/2027"          → "May 2027"
 *   "2027-05"          → "May 2027"
 *   "2024 - current"   → "2024 – Present"
 *   "jan 2023 to now"  → "Jan 2023 – Present"
 *   "summer 2025"      → "Summer 2025"
 *
 * Anything it doesn't recognise is left alone apart from whitespace.
 */
export function normalizeDateText(input: string): string {
  let s = input.trim().replace(/\s+/g, ' ')
  if (s === '') return s

  // Numeric month forms first, before the hyphen in "2027-05" can be read
  // as a range separator.
  s = s.replace(/\b(\d{4})-(\d{1,2})\b(?!-)/g, (m, y: string, mo: string) => {
    const name = monthName(Number(mo))
    return name ? `${name} ${y}` : m
  })
  s = s.replace(/\b(\d{1,2})\/(\d{4})\b/g, (m, mo: string, y: string) => {
    const name = monthName(Number(mo))
    return name ? `${name} ${y}` : m
  })

  s = s.replace(/\b(present|current|currently|now|today|ongoing)\b/gi, 'Present')
  s = s.replace(/\s*(?:–|—|--?)\s*/g, ' – ')
  s = s.replace(/\s+to\s+/gi, ' – ')
  s = s.replace(CAPITALIZE, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
  return s.trim()
}

/** True for a real calendar date in yyyy-mm-dd form. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Coerces an application date to yyyy-mm-dd, falling back to today. */
export function normalizeIsoDate(value: string, today = new Date()): string {
  const trimmed = value.trim()
  if (isIsoDate(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  if (trimmed !== '' && !Number.isNaN(parsed.getTime())) {
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  }
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

// ─── Normalize on write ─────────────────────────────────────────────────────

const t = (s: string) => s.trim()

export function normalizeBlock(block: ResumeBlock): ResumeBlock {
  const label = t(block.label) || SECTION_LABELS[block.type]
  switch (block.type) {
    case 'summary':
      return { ...block, label, data: { text: t(block.data.text) } }
    case 'experience':
      return {
        ...block,
        label,
        data: {
          items: block.data.items.map((item) => ({
            role: t(item.role),
            org: t(item.org),
            dates: normalizeDateText(item.dates),
            points: item.points.map(t).filter((p) => p !== ''),
          })),
        },
      }
    case 'skills':
      return {
        ...block,
        label,
        data: { groups: block.data.groups.map((g) => ({ name: t(g.name), items: t(g.items) })) },
      }
    case 'education':
      return {
        ...block,
        label,
        data: {
          items: block.data.items.map((item) => ({
            school: t(item.school),
            degree: t(item.degree),
            dates: normalizeDateText(item.dates),
            detail: t(item.detail),
          })),
        },
      }
    case 'projects':
      return {
        ...block,
        label,
        data: { items: block.data.items.map((p) => ({ name: t(p.name), detail: t(p.detail) })) },
      }
    case 'custom':
      return {
        ...block,
        label,
        data: {
          items: block.data.items.map((c) => ({
            name: t(c.name),
            meta: normalizeDateText(c.meta),
            detail: t(c.detail),
          })),
        },
      }
  }
}

export function normalizeProfile(profile: Profile): Profile {
  return {
    name: t(profile.name),
    title: t(profile.title),
    email: t(profile.email).toLowerCase(),
    phone: t(profile.phone),
    location: t(profile.location),
    links: t(profile.links),
  }
}

export function normalizeResume(resume: Resume): Resume {
  return {
    id: resume.id,
    title: t(resume.title) || 'My resume',
    templateId: resume.templateId,
    profile: normalizeProfile(resume.profile),
    blocks: resume.blocks.map(normalizeBlock),
  }
}

export function normalizeApplication(draft: ApplicationDraft): ApplicationDraft {
  const out: ApplicationDraft = {
    employer: t(draft.employer),
    role: t(draft.role),
    status: draft.status,
    versionId: draft.versionId || null,
    appliedAt: normalizeIsoDate(draft.appliedAt),
  }
  // A custom label only means something while the status is 'Custom'.
  if (draft.status === 'Custom' && draft.customStatus?.trim()) {
    out.customStatus = draft.customStatus.trim()
  }
  return out
}

// ─── Parse on read ──────────────────────────────────────────────────────────

type Loose = Record<string, unknown>

const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const objs = (v: unknown): Loose[] => arr(v).filter(isObj)

export function parseProfile(raw: unknown): Profile {
  const p = isObj(raw) ? raw : {}
  return {
    name: str(p.name),
    title: str(p.title),
    email: str(p.email),
    phone: str(p.phone),
    location: str(p.location),
    links: str(p.links),
  }
}

export function parseTemplateId(raw: unknown): TemplateId {
  return TEMPLATES.some((tpl) => tpl.id === raw) ? (raw as TemplateId) : DEFAULT_TEMPLATE
}

/** Returns null for anything that isn't a recognisable block, so one bad entry drops out instead of breaking the page. */
export function parseBlock(raw: unknown): ResumeBlock | null {
  if (!isObj(raw)) return null
  const type = raw.type
  if (typeof type !== 'string' || !SECTION_TYPES.includes(type as SectionType)) return null
  const base = {
    id: str(raw.id) || nextId('b'),
    label: str(raw.label) || SECTION_LABELS[type as SectionType],
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
  }
  const data = isObj(raw.data) ? raw.data : {}

  switch (type as SectionType) {
    case 'summary':
      return { ...base, type: 'summary', data: { text: str(data.text) } }
    case 'experience':
      return {
        ...base,
        type: 'experience',
        data: {
          items: objs(data.items).map((i) => ({
            role: str(i.role),
            org: str(i.org),
            dates: str(i.dates),
            points: arr(i.points).filter((p): p is string => typeof p === 'string'),
          })),
        },
      }
    case 'skills':
      return {
        ...base,
        type: 'skills',
        data: { groups: objs(data.groups).map((g) => ({ name: str(g.name), items: str(g.items) })) },
      }
    case 'education':
      return {
        ...base,
        type: 'education',
        data: {
          items: objs(data.items).map((i) => ({
            school: str(i.school),
            degree: str(i.degree),
            dates: str(i.dates),
            detail: str(i.detail),
          })),
        },
      }
    case 'projects':
      return {
        ...base,
        type: 'projects',
        data: { items: objs(data.items).map((i) => ({ name: str(i.name), detail: str(i.detail) })) },
      }
    case 'custom':
      return {
        ...base,
        type: 'custom',
        data: {
          items: objs(data.items).map((i) => ({
            name: str(i.name),
            meta: str(i.meta),
            detail: str(i.detail),
          })),
        },
      }
  }
}

export function parseBlocks(raw: unknown): ResumeBlock[] {
  return arr(raw)
    .map(parseBlock)
    .filter((b): b is ResumeBlock => b !== null)
}

/** Parses a whole Resume, e.g. the JSON inside a version snapshot. */
export function parseResume(raw: unknown, fallbackId = ''): Resume {
  const r = isObj(raw) ? raw : {}
  return {
    id: str(r.id) || fallbackId,
    title: str(r.title) || 'My resume',
    templateId: parseTemplateId(r.templateId),
    profile: parseProfile(r.profile),
    blocks: parseBlocks(r.blocks),
  }
}

export function parseStatus(raw: unknown): ApplicationDraft['status'] {
  return raw === 'Custom' || APPLICATION_STATUSES.includes(raw as never)
    ? (raw as ApplicationDraft['status'])
    : 'Applied'
}
