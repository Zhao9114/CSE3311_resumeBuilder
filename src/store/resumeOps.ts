import type { Resume, ResumeBlock, SectionType, TemplateId } from '../types'
import { isRepeatable } from '../types'
import { blankBlock } from '../data/seed'

/**
 * Pure resume mutations. Each takes a resume and returns a new one, never
 * touching its input.
 *
 * Both the in-memory and the Supabase store call these, so the reorder,
 * show/hide and add rules exist in exactly one place and the unit tests that
 * run against the in-memory store also cover what gets persisted.
 */

let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}${Date.now().toString(36)}${idCounter}`
}

export function cloneResume(resume: Resume): Resume {
  return structuredClone(resume)
}

export function updateProfile(resume: Resume, patch: Partial<Resume['profile']>): Resume {
  const next = cloneResume(resume)
  next.profile = { ...next.profile, ...patch }
  return next
}

export function setTemplate(resume: Resume, templateId: TemplateId): Resume {
  const next = cloneResume(resume)
  next.templateId = templateId
  return next
}

export function addBlock(resume: Resume, type: SectionType, title?: string): Resume {
  const next = cloneResume(resume)
  // Built-ins are capped at one each; custom sections are unlimited.
  const alreadyPresent = !isRepeatable(type) && next.blocks.some((b) => b.type === type)
  if (!alreadyPresent) next.blocks.push(blankBlock(type, nextId('b'), title))
  return next
}

export function insertBlock(resume: Resume, block: Omit<ResumeBlock, 'id'>): Resume {
  const next = cloneResume(resume)
  // A library block is a copy: it gets a fresh id and never aliases the
  // saved entry, so later edits cannot write back into the library.
  next.blocks.push({ ...structuredClone(block), id: nextId('b') } as ResumeBlock)
  return next
}

export function removeBlock(resume: Resume, blockId: string): Resume {
  const next = cloneResume(resume)
  next.blocks = next.blocks.filter((b) => b.id !== blockId)
  return next
}

export function updateBlock(resume: Resume, block: ResumeBlock): Resume {
  const next = cloneResume(resume)
  const index = next.blocks.findIndex((b) => b.id === block.id)
  if (index !== -1) next.blocks[index] = structuredClone(block)
  return next
}

export function toggleBlock(resume: Resume, blockId: string, enabled: boolean): Resume {
  const next = cloneResume(resume)
  const block = next.blocks.find((b) => b.id === blockId)
  if (block) block.enabled = enabled
  return next
}

/**
 * Array order is render order, so a reorder is a splice. Out-of-range or
 * same-index moves are no-ops rather than errors: dnd-kit can report a drop
 * outside the list, and that should leave the resume as it was.
 */
export function reorderBlocks(resume: Resume, fromIndex: number, toIndex: number): Resume {
  const next = cloneResume(resume)
  const max = next.blocks.length - 1
  if (
    fromIndex < 0 || fromIndex > max ||
    toIndex < 0 || toIndex > max ||
    fromIndex === toIndex
  ) {
    return next
  }
  const [moved] = next.blocks.splice(fromIndex, 1)
  next.blocks.splice(toIndex, 0, moved)
  return next
}
