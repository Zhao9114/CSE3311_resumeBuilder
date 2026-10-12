import type {
  Application,
  ApplicationDraft,
  Resume,
  ResumeBlock,
  ResumeVersion,
  SavedBlock,
  SavedBlockDraft,
  SectionType,
  TemplateId,
} from '../types'

/**
 * Data access contract for resumes.
 *
 * Every method is async so the in-memory implementation (demo mode, tests)
 * and the Supabase one share one signature, and components never learn which
 * they are talking to. Components must never reach past these methods to
 * mutate state directly.
 */
export interface ResumeStore {
  list(): Promise<Resume[]>
  get(id: string): Promise<Resume | undefined>
  save(resume: Resume): Promise<Resume>
  updateProfile(resumeId: string, patch: Partial<Resume['profile']>): Promise<Resume>
  setTemplate(resumeId: string, templateId: TemplateId): Promise<Resume>

  /** `title` names a custom section; built-ins use their fixed label. */
  addBlock(resumeId: string, type: SectionType, title?: string): Promise<Resume>
  /** Append a ready-made block, e.g. a copy pulled from the block library. */
  insertBlock(resumeId: string, block: Omit<ResumeBlock, 'id'>): Promise<Resume>
  removeBlock(resumeId: string, blockId: string): Promise<Resume>
  updateBlock(resumeId: string, block: ResumeBlock): Promise<Resume>
  toggleBlock(resumeId: string, blockId: string, enabled: boolean): Promise<Resume>
  /** Move a block from one index to another; array order is render order. */
  reorderBlocks(resumeId: string, fromIndex: number, toIndex: number): Promise<Resume>
}

/** Data access contract for tracked job applications. */
export interface ApplicationStore {
  list(): Promise<Application[]>
  add(draft: ApplicationDraft): Promise<Application>
  update(id: string, patch: Partial<ApplicationDraft>): Promise<Application>
  remove(id: string): Promise<void>
}

/** Saved blocks the user can reuse across resumes. */
export interface BlockLibraryStore {
  list(): Promise<SavedBlock[]>
  save(draft: SavedBlockDraft): Promise<SavedBlock>
  rename(id: string, name: string): Promise<SavedBlock>
  remove(id: string): Promise<void>
}

/**
 * Immutable resume snapshots. There is deliberately no update or delete:
 * an application points at a version as a record of what was sent, and
 * that record must not change underneath it. Restoring a version is a write
 * to the live resume (`ResumeStore.save`), never to the version.
 */
export interface ResumeVersionStore {
  /** Freeze a deep copy of `resume` as it stands right now. */
  snapshot(resume: Resume, label: string): Promise<ResumeVersion>
  /** Newest first. Pass a resume id to see only that resume's versions. */
  list(resumeId?: string): Promise<ResumeVersion[]>
  get(id: string): Promise<ResumeVersion | undefined>
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Optional, for stores that save in the background. The Supabase resume
 * store returns from each edit immediately and writes a moment later, so the
 * UI needs a separate signal for "your work is safe".
 */
export interface SyncStatusSource {
  getSyncStatus(): SyncStatus
  subscribe(listener: (status: SyncStatus) => void): () => void
  /** Write anything still pending. Called before sign-out and page unload. */
  flush(): Promise<void>
}

export function isSyncStatusSource(store: unknown): store is SyncStatusSource {
  return (
    typeof store === 'object' &&
    store !== null &&
    'subscribe' in store &&
    'flush' in store &&
    'getSyncStatus' in store
  )
}
