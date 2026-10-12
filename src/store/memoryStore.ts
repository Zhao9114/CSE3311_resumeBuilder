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
import { seedApplications, seedResumes, seedVersions } from '../data/seed'
import * as ops from './resumeOps'
import { cloneResume, nextId } from './resumeOps'
import type {
  ApplicationStore,
  BlockLibraryStore,
  ResumeStore,
  ResumeVersionStore,
} from './types'

/**
 * In-memory stores. Used in demo mode (no Supabase env vars) and by the unit
 * tests. Every read and write clones, so callers can never hold a reference
 * into the store's own state — the same guarantee a network store gets for
 * free from serialization.
 */
export class InMemoryResumeStore implements ResumeStore {
  private resumes: Resume[]

  constructor(seed: Resume[] = seedResumes) {
    this.resumes = seed.map(cloneResume)
  }

  async list(): Promise<Resume[]> {
    return this.resumes.map(cloneResume)
  }

  async get(id: string): Promise<Resume | undefined> {
    const found = this.resumes.find((r) => r.id === id)
    return found ? cloneResume(found) : undefined
  }

  async save(resume: Resume): Promise<Resume> {
    const index = this.resumes.findIndex((r) => r.id === resume.id)
    if (index === -1) this.resumes.push(cloneResume(resume))
    else this.resumes[index] = cloneResume(resume)
    return cloneResume(resume)
  }

  updateProfile(resumeId: string, patch: Partial<Resume['profile']>): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.updateProfile(r, patch))
  }

  setTemplate(resumeId: string, templateId: TemplateId): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.setTemplate(r, templateId))
  }

  addBlock(resumeId: string, type: SectionType, title?: string): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.addBlock(r, type, title))
  }

  insertBlock(resumeId: string, block: Omit<ResumeBlock, 'id'>): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.insertBlock(r, block))
  }

  removeBlock(resumeId: string, blockId: string): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.removeBlock(r, blockId))
  }

  updateBlock(resumeId: string, block: ResumeBlock): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.updateBlock(r, block))
  }

  toggleBlock(resumeId: string, blockId: string, enabled: boolean): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.toggleBlock(r, blockId, enabled))
  }

  reorderBlocks(resumeId: string, fromIndex: number, toIndex: number): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.reorderBlocks(r, fromIndex, toIndex))
  }

  private async apply(resumeId: string, op: (r: Resume) => Resume): Promise<Resume> {
    const index = this.resumes.findIndex((r) => r.id === resumeId)
    if (index === -1) throw new Error(`Resume not found: ${resumeId}`)
    const next = op(this.resumes[index])
    this.resumes[index] = next
    return cloneResume(next)
  }
}

export class InMemoryResumeVersionStore implements ResumeVersionStore {
  private versions: ResumeVersion[]

  constructor(seed: ResumeVersion[] = seedVersions) {
    this.versions = seed.map((v) => structuredClone(v))
  }

  async snapshot(resume: Resume, label: string): Promise<ResumeVersion> {
    // structuredClone is the immutability guarantee: the version shares no
    // objects with the live resume, so later edits to it cannot leak in.
    const version: ResumeVersion = {
      id: nextId('v'),
      resumeId: resume.id,
      label: label.trim() || 'Untitled version',
      createdAt: new Date().toISOString(),
      resume: cloneResume(resume),
    }
    this.versions.push(version)
    return structuredClone(version)
  }

  async list(resumeId?: string): Promise<ResumeVersion[]> {
    return this.versions
      .filter((v) => resumeId === undefined || v.resumeId === resumeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((v) => structuredClone(v))
  }

  async get(id: string): Promise<ResumeVersion | undefined> {
    const found = this.versions.find((v) => v.id === id)
    return found ? structuredClone(found) : undefined
  }
}

export class InMemoryBlockLibraryStore implements BlockLibraryStore {
  private saved: SavedBlock[] = []

  async list(): Promise<SavedBlock[]> {
    return this.saved.map((s) => structuredClone(s))
  }

  async save(draft: SavedBlockDraft): Promise<SavedBlock> {
    const entry: SavedBlock = {
      ...structuredClone(draft),
      id: nextId('lib'),
      savedAt: new Date().toISOString(),
    }
    this.saved.unshift(entry)
    return structuredClone(entry)
  }

  async rename(id: string, name: string): Promise<SavedBlock> {
    const entry = this.saved.find((s) => s.id === id)
    if (!entry) throw new Error(`Saved block not found: ${id}`)
    entry.name = name
    return structuredClone(entry)
  }

  async remove(id: string): Promise<void> {
    this.saved = this.saved.filter((s) => s.id !== id)
  }
}

export class InMemoryApplicationStore implements ApplicationStore {
  private applications: Application[]

  constructor(seed: Application[] = seedApplications) {
    this.applications = seed.map((a) => ({ ...a }))
  }

  async list(): Promise<Application[]> {
    return this.applications.map((a) => ({ ...a }))
  }

  async add(draft: ApplicationDraft): Promise<Application> {
    const app: Application = { ...draft, id: nextId('a') }
    this.applications.unshift(app)
    return { ...app }
  }

  async update(id: string, patch: Partial<ApplicationDraft>): Promise<Application> {
    const index = this.applications.findIndex((a) => a.id === id)
    if (index === -1) throw new Error(`Application not found: ${id}`)
    const next = { ...this.applications[index], ...patch }
    // Drop a stale custom label if the status moved off 'Custom'.
    if (next.status !== 'Custom') delete next.customStatus
    this.applications[index] = next
    return { ...next }
  }

  async remove(id: string): Promise<void> {
    this.applications = this.applications.filter((a) => a.id !== id)
  }
}
