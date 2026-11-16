import type { ResumeBlock } from '../types'

/**
 * Entries are the unit of the block bank: one role, one project, one
 * education entry, one skill group, or a summary. Each is stored as an
 * ordinary block holding a single item, so the existing `saved_blocks` table,
 * mappers and validation carry it unchanged.
 *
 * Small pieces are what make mix-and-match possible: the tailoring step can
 * pick the best three of six saved roles for a posting, which it cannot do
 * when the only thing saved is one whole Experience section.
 *
 * Pure functions, shared by the browser and the serverless functions.
 */

export type BlockDraft = Omit<ResumeBlock, 'id'>

/**
 * `Omit` over a union is not distributive, so a `BlockDraft` no longer
 * narrows on `type`. This view of the same value does.
 */
type Narrow = ResumeBlock extends infer B ? (B extends ResumeBlock ? Omit<B, 'id'> : never) : never
const narrow = (b: BlockDraft) => b as Narrow

const clean = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** The individual entries a block is made of, each as a one-item block. */
export function splitIntoEntries(input: BlockDraft): BlockDraft[] {
  const block = narrow(input)
  const base = { type: block.type, label: block.label, enabled: true }
  switch (block.type) {
    case 'summary':
      return block.data.text.trim() ? [{ ...base, type: 'summary', data: { text: block.data.text } }] : []
    case 'experience':
      return block.data.items
        .filter((i) => i.role.trim() || i.org.trim() || i.points.some((p) => p.trim()))
        .map((item) => ({ ...base, type: 'experience', data: { items: [structuredClone(item)] } }))
    case 'skills':
      return block.data.groups
        .filter((g) => g.items.trim())
        .map((group) => ({ ...base, type: 'skills', data: { groups: [{ ...group }] } }))
    case 'education':
      return block.data.items
        .filter((i) => i.school.trim() || i.degree.trim())
        .map((item) => ({ ...base, type: 'education', data: { items: [{ ...item }] } }))
    case 'projects':
      return block.data.items
        .filter((i) => i.name.trim() || i.detail.trim())
        .map((item) => ({ ...base, type: 'projects', data: { items: [{ ...item }] } }))
    case 'custom':
      return block.data.items
        .filter((i) => i.name.trim() || i.detail.trim())
        .map((item) => ({ ...base, type: 'custom', data: { items: [{ ...item }] } }))
  }
}

/** A short human name for an entry, e.g. "Software Engineering Intern · Northbridge Labs". */
export function entryName(input: BlockDraft): string {
  const block = narrow(input)
  const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' · ')
  switch (block.type) {
    case 'summary':
      return 'Summary'
    case 'experience': {
      const i = block.data.items[0]
      return (i && join(i.role, i.org)) || 'Experience entry'
    }
    case 'skills':
      return block.data.groups[0]?.name.trim() || 'Skill group'
    case 'education': {
      const i = block.data.items[0]
      return (i && join(i.degree, i.school)) || 'Education entry'
    }
    case 'projects':
      return block.data.items[0]?.name.trim() || 'Project'
    case 'custom':
      return join(block.label, block.data.items[0]?.name ?? '') || 'Custom entry'
  }
}

/**
 * The content of one item, normalized (case and spacing), so the same role
 * saved twice — or a bank entry that is already on the resume — is spotted.
 */
function itemKey(type: ResumeBlock['type'], item: unknown): string {
  const values = Object.values(item as Record<string, unknown>).map((v) =>
    Array.isArray(v) ? v.map((x) => clean(String(x))).join('|') : clean(String(v ?? '')),
  )
  return `${type}:${values.join('§')}`
}

/** One key per item in the block; a one-item entry has exactly one. */
export function itemKeys(input: BlockDraft): string[] {
  const block = narrow(input)
  switch (block.type) {
    case 'summary':
      return [itemKey('summary', { text: block.data.text })]
    case 'skills':
      return block.data.groups.map((g) => itemKey('skills', g))
    case 'custom':
      return block.data.items.map((i) => itemKey('custom', { label: block.label, ...i }))
    default:
      return block.data.items.map((i) => itemKey(block.type, i))
  }
}

/** Identity of a whole entry (or block) by content, for de-duplication. */
export function entryFingerprint(block: BlockDraft): string {
  return itemKeys(block).join('\n')
}

/**
 * Appends the items of `incoming` into `target` (same section type),
 * skipping any item the target already has. Summary is the exception: a
 * resume has one summary text, so the incoming one replaces it.
 */
export function mergeInto<B extends BlockDraft>(target: B, input: BlockDraft): B {
  const incoming = narrow(input)
  if (target.type !== incoming.type) return structuredClone(target)
  const next = structuredClone(target) as unknown as Narrow
  const have = new Set(itemKeys(next))
  switch (next.type) {
    case 'summary':
      if (incoming.type === 'summary') next.data = { text: incoming.data.text }
      break
    case 'skills':
      if (incoming.type === 'skills') {
        for (const g of incoming.data.groups) {
          if (!have.has(itemKey('skills', g))) next.data.groups.push({ ...g })
        }
      }
      break
    case 'experience':
      if (incoming.type === 'experience') {
        for (const i of incoming.data.items) {
          if (!have.has(itemKey('experience', i))) next.data.items.push(structuredClone(i))
        }
      }
      break
    case 'education':
      if (incoming.type === 'education') {
        for (const i of incoming.data.items) {
          if (!have.has(itemKey('education', i))) next.data.items.push({ ...i })
        }
      }
      break
    case 'projects':
      if (incoming.type === 'projects') {
        for (const i of incoming.data.items) {
          if (!have.has(itemKey('projects', i))) next.data.items.push({ ...i })
        }
      }
      break
    case 'custom':
      if (incoming.type === 'custom') {
        for (const i of incoming.data.items) {
          if (!have.has(itemKey('custom', { label: next.label, ...i }))) next.data.items.push({ ...i })
        }
      }
      break
  }
  return next as B
}

/** The entry at `index` inside a section (a role, a skill group), or null. */
export function entryAt(input: BlockDraft, index: number): BlockDraft | null {
  const block = narrow(input)
  if (block.type === 'summary') return index === 0 ? splitIntoEntries(block)[0] ?? null : null
  const base = { label: block.label, enabled: true }
  switch (block.type) {
    case 'skills': {
      const g = block.data.groups[index]
      return g ? { ...base, type: 'skills', data: { groups: [{ ...g }] } } : null
    }
    case 'experience': {
      const i = block.data.items[index]
      return i ? { ...base, type: 'experience', data: { items: [structuredClone(i)] } } : null
    }
    case 'education': {
      const i = block.data.items[index]
      return i ? { ...base, type: 'education', data: { items: [{ ...i }] } } : null
    }
    case 'projects': {
      const i = block.data.items[index]
      return i ? { ...base, type: 'projects', data: { items: [{ ...i }] } } : null
    }
    case 'custom': {
      const i = block.data.items[index]
      return i ? { ...base, type: 'custom', data: { items: [{ ...i }] } } : null
    }
  }
}
