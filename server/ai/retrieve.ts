/**
 * The retrieval half of tailoring (the "R" in RAG).
 *
 * Given the keywords a posting asks for, rank every entry the user has — the
 * roles, projects and skill groups on the live resume plus everything in their
 * block bank — by how many of those keywords it covers, then assemble a
 * resume from the best ones. This is plain code, like the ATS score:
 *
 *  - it is free (no model call), so ranking a hundred entries costs nothing;
 *  - the same resume, bank and posting always give the same picks;
 *  - every pick can be explained ("covers React, TypeScript");
 *  - the model only ever sees the few entries chosen here, so it cannot
 *    pull in experience the user does not have.
 */
import { blockToText } from '../../src/ai/resumeText.js'
import { entryFingerprint, entryName, splitIntoEntries, type BlockDraft } from '../../src/store/entries.js'
import { nextId } from '../../src/store/resumeOps.js'
import type { BuiltInSectionType, Resume, ResumeBlock, SkillGroup } from '../../src/types/index.js'
import { buildIndex, keywordFound, type Keyword } from './atsScore.js'

export type EntrySource = 'resume' | 'bank'

export interface RankedEntry {
  entry: BlockDraft
  source: EntrySource
  name: string
  /** Keyword terms this entry covers. */
  matched: string[]
  requiredHits: number
  preferredHits: number
  /** 3 per required keyword covered, 1 per nice-to-have. */
  score: number
}

export interface Pick {
  section: BuiltInSectionType
  name: string
  source: EntrySource
  score: number
  matched: string[]
}

export interface TailoredDraft {
  resume: Resume
  picks: Pick[]
  /** Resume entries the draft leaves out, so the user sees what was dropped. */
  left: { section: BuiltInSectionType; name: string }[]
}

export const REQUIRED_WEIGHT = 3
export const PREFERRED_WEIGHT = 1
export const CAPS = { experience: 3, projects: 2, skills: 5 } as const

/** Narrows a draft on `type` (Omit over a union loses that). */
const asBlock = (b: BlockDraft) => b as ResumeBlock

function coverage(text: string, required: Keyword[], preferred: Keyword[]) {
  const index = buildIndex(text)
  const req = required.filter((k) => keywordFound(index, k))
  const pref = preferred.filter((k) => keywordFound(index, k))
  return {
    matched: [...req, ...pref].map((k) => k.term),
    requiredHits: req.length,
    preferredHits: pref.length,
    score: REQUIRED_WEIGHT * req.length + PREFERRED_WEIGHT * pref.length,
  }
}

/**
 * Every distinct entry from the resume and the bank, scored. An entry that
 * is in both counts once, as the resume's. The sort is stable: ties keep
 * resume entries first, in their original order.
 */
export function rankEntries(
  resume: Resume,
  bank: BlockDraft[],
  required: Keyword[],
  preferred: Keyword[],
): RankedEntry[] {
  const seen = new Set<string>()
  const pool: { entry: BlockDraft; source: EntrySource }[] = []
  const add = (block: BlockDraft, source: EntrySource) => {
    for (const entry of splitIntoEntries(block)) {
      const key = entryFingerprint(entry)
      if (seen.has(key)) continue
      seen.add(key)
      pool.push({ entry, source })
    }
  }
  for (const b of resume.blocks) {
    const { id: _id, ...draft } = b
    add(draft, 'resume')
  }
  for (const b of bank) add(b, 'bank')

  return pool
    .map(({ entry, source }) => ({
      entry,
      source,
      name: entryName(entry),
      ...coverage(blockToText(asBlock({ ...entry, label: '' } as BlockDraft)), required, preferred),
    }))
    .map((r, order) => ({ r, order }))
    .sort((a, b) => b.r.score - a.r.score || a.order - b.order)
    .map(({ r }) => r)
}

/** Bullets that cover the posting's keywords move to the top; ties keep their order. */
export function reorderPoints(points: string[], required: Keyword[], preferred: Keyword[]): string[] {
  return points
    .map((p, i) => ({ p, i, s: coverage(p, required, preferred).score }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ p }) => p)
}

/** Skills the posting asks for move to the front of their group. */
export function reorderSkills(group: SkillGroup, required: Keyword[], preferred: Keyword[]): SkillGroup {
  const items = group.items.split(',').map((s) => s.trim()).filter(Boolean)
  const sorted = items
    .map((s, i) => ({ s, i, score: coverage(s, required, preferred).score }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ s }) => s)
  return { name: group.name, items: sorted.join(', ') }
}

const of = <T extends BuiltInSectionType>(ranked: RankedEntry[], type: T) =>
  ranked.filter((r) => r.entry.type === type)

/**
 * Builds the tailored resume from the ranked entries:
 *  - experience: the 3 most relevant roles, bullets reordered;
 *  - projects: up to 2 that cover a keyword (or the resume's own if none do);
 *  - skills: the resume's groups plus bank groups that cover a keyword,
 *    matching skills first;
 *  - education: kept as is (it is rarely what a posting discriminates on);
 *  - summary and custom sections: kept; the model rewrites the summary next.
 *
 * Section order follows the live resume; sections the resume lacked are
 * appended. Existing sections keep their ids so the editor state carries over.
 */
export function assembleTailored(
  resume: Resume,
  bank: BlockDraft[],
  required: Keyword[],
  preferred: Keyword[],
): TailoredDraft {
  const ranked = rankEntries(resume, bank, required, preferred)
  const picks: Pick[] = []
  const pick = (section: BuiltInSectionType, r: RankedEntry) =>
    picks.push({ section, name: r.name, source: r.source, score: r.score, matched: r.matched })

  // Experience — the most relevant roles, wherever they came from.
  const roles = of(ranked, 'experience').slice(0, CAPS.experience)
  roles.forEach((r) => pick('experience', r))
  const experienceItems = roles.flatMap((r) => {
    const b = asBlock(r.entry)
    return b.type === 'experience'
      ? b.data.items.map((i) => ({ ...i, points: reorderPoints(i.points, required, preferred) }))
      : []
  })

  // Projects — only ones that earn their place, unless none do.
  const allProjects = of(ranked, 'projects')
  const relevant = allProjects.filter((r) => r.score > 0).slice(0, CAPS.projects)
  const projects = relevant.length > 0 ? relevant : allProjects.filter((r) => r.source === 'resume')
  projects.forEach((r) => pick('projects', r))
  const projectItems = projects.flatMap((r) => {
    const b = asBlock(r.entry)
    return b.type === 'projects' ? b.data.items : []
  })

  // Skills — keep the resume's groups, add matching bank groups.
  const groups = of(ranked, 'skills')
    .filter((r) => r.source === 'resume' || r.score > 0)
    .slice(0, CAPS.skills)
  groups.filter((r) => r.source === 'bank' || r.score > 0).forEach((r) => pick('skills', r))
  const skillGroups = groups.flatMap((r) => {
    const b = asBlock(r.entry)
    return b.type === 'skills' ? b.data.groups.map((g) => reorderSkills(g, required, preferred)) : []
  })

  // Education — the resume's; the bank's only if the resume has none.
  const edu = of(ranked, 'education')
  const eduPicks = edu.some((r) => r.source === 'resume') ? edu.filter((r) => r.source === 'resume') : edu.slice(0, 1)
  const educationItems = eduPicks.flatMap((r) => {
    const b = asBlock(r.entry)
    return b.type === 'education' ? b.data.items : []
  })

  const built: Partial<Record<BuiltInSectionType, ResumeBlock>> = {}
  const existing = (type: BuiltInSectionType) => resume.blocks.find((b) => b.type === type)
  const make = <T extends BuiltInSectionType>(type: T, data: unknown, enabled: boolean, label: string) => {
    const prev = existing(type)
    built[type] = { id: prev?.id ?? nextId('b'), type, label: prev?.label ?? label, enabled, data } as ResumeBlock
  }
  if (experienceItems.length) make('experience', { items: experienceItems }, true, 'Experience')
  if (projectItems.length) make('projects', { items: projectItems }, relevant.length > 0 || existing('projects')?.enabled === true, 'Projects')
  if (skillGroups.length) make('skills', { groups: skillGroups }, true, 'Skills')
  if (educationItems.length) make('education', { items: educationItems }, existing('education')?.enabled ?? true, 'Education')

  const blocks: ResumeBlock[] = []
  for (const b of resume.blocks) {
    const replacement = b.type !== 'custom' && b.type !== 'summary' ? built[b.type] : undefined
    if (replacement) {
      blocks.push(replacement)
      delete built[b.type as BuiltInSectionType]
    } else if (b.type === 'summary' || b.type === 'custom') {
      blocks.push(structuredClone(b))
    }
    // A built-in section with nothing picked for it is dropped.
  }
  for (const type of ['experience', 'projects', 'skills', 'education'] as const) {
    const b = built[type]
    if (b) blocks.push(b)
  }

  const pickedKeys = new Set(
    [...roles, ...projects, ...groups, ...eduPicks].map((r) => entryFingerprint(r.entry)),
  )
  const left = ranked
    .filter((r) => r.source === 'resume' && r.entry.type !== 'summary' && r.entry.type !== 'custom')
    .filter((r) => !pickedKeys.has(entryFingerprint(r.entry)))
    .map((r) => ({ section: r.entry.type as BuiltInSectionType, name: r.name }))

  return { resume: { ...structuredClone(resume), blocks }, picks, left }
}
