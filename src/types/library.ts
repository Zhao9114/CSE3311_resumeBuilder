import type { ResumeBlock } from './resume'

/**
 * A block saved out of a resume for reuse — a frontend-flavoured Experience
 * block, a backend one, an ML Skills block. Inserting one copies it into the
 * current resume; the saved entry is never mutated by later edits.
 */
export interface SavedBlock {
  id: string
  /** What the user called it, e.g. "Experience — Backend". */
  name: string
  /** Free-form tags for filtering, e.g. ['backend', 'go']. */
  tags: string[]
  /** The block itself, stored without its resume-scoped id. */
  block: Omit<ResumeBlock, 'id'>
  savedAt: string
}

export type SavedBlockDraft = Omit<SavedBlock, 'id' | 'savedAt'>
