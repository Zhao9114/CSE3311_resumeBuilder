import type { ResumeBlock, SectionType } from '../../types'

/**
 * What is being dragged. Every draggable in the builder carries one of these
 * as its dnd-kit `data`, and the provider decides what a drop means from it.
 */
export type DragData =
  /** A section card in the editor list, being reordered. */
  | { kind: 'block'; blockId: string }
  /** A section on the resume paper, being reordered in place. */
  | { kind: 'paper'; blockId: string; column: PaperColumn }
  /** A chip from "Add a section": dropping it creates a fresh section. */
  | { kind: 'new-section'; sectionType: SectionType }
  /** A block-library entry: dropping it inserts a copy. */
  | { kind: 'saved-block'; block: Omit<ResumeBlock, 'id'>; name: string }
  /** An assistant proposal: dropping it inserts the proposed section. */
  | { kind: 'proposal'; block: ResumeBlock; onApplied: () => void }

export type PaperColumn = 'single' | 'main' | 'aside'

/** Things dragged in from outside the list, which add a section when dropped. */
export type IncomingDrag = Extract<DragData, { kind: 'new-section' | 'saved-block' | 'proposal' }>

export function isIncoming(data: DragData | null | undefined): data is IncomingDrag {
  return data?.kind === 'new-section' || data?.kind === 'saved-block' || data?.kind === 'proposal'
}

/** The editor list as a whole: dragging something in requires the pointer inside it. */
export const LIST_DROP_ID = 'drop:block-list'
export const HIDE_ZONE_ID = 'drop:hide'
export const REMOVE_ZONE_ID = 'drop:remove'

export const paperId = (blockId: string) => `paper:${blockId}`
