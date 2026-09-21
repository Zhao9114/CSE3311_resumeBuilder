import type {
  Application,
  ApplicationDraft,
  Resume,
  ResumeBlock,
  SectionType,
} from '../types'

/**
 * Data access contract for resumes.
 *
 * Every method is async so the in-memory implementation and a future
 * network-backed one share one signature.
 *
 * TODO(iteration-2): add a SupabaseResumeStore implementing this interface.
 * Components must never reach past these methods to mutate state directly.
 */
export interface ResumeStore {
  list(): Promise<Resume[]>
  get(id: string): Promise<Resume | undefined>
  save(resume: Resume): Promise<Resume>
  updateProfile(resumeId: string, patch: Partial<Resume['profile']>): Promise<Resume>

  /** `title` names a custom section; built-ins use their fixed label. */
  addBlock(resumeId: string, type: SectionType, title?: string): Promise<Resume>
  removeBlock(resumeId: string, blockId: string): Promise<Resume>
  updateBlock(resumeId: string, block: ResumeBlock): Promise<Resume>
  toggleBlock(resumeId: string, blockId: string, enabled: boolean): Promise<Resume>
  /** Move a block from one index to another; array order is render order. */
  reorderBlocks(resumeId: string, fromIndex: number, toIndex: number): Promise<Resume>
}

/**
 * Data access contract for tracked job applications.
 *
 * TODO(iteration-2): add a SupabaseApplicationStore implementing this interface.
 */
export interface ApplicationStore {
  list(): Promise<Application[]>
  add(draft: ApplicationDraft): Promise<Application>
  update(id: string, patch: Partial<ApplicationDraft>): Promise<Application>
  remove(id: string): Promise<void>
}

/**
 * TODO(iteration-2): resume version snapshots. The tracker already records
 * which resume an application used, so snapshots slot in behind this
 * interface without touching the tracker UI.
 */
export interface ResumeVersionStore {
  snapshot(resumeId: string, label: string): Promise<Resume>
  listVersions(resumeId: string): Promise<Resume[]>
  restore(versionId: string): Promise<Resume>
}

/**
 * TODO(iteration-2): real auth. Iteration 1 has no users; every store call
 * runs as a single implicit local user.
 */
export interface AuthGateway {
  currentUserId(): Promise<string | null>
  signIn(email: string, password: string): Promise<string>
  signOut(): Promise<void>
}
