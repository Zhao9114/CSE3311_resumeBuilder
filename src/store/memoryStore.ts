import type {
  Application,
  ApplicationDraft,
  Resume,
  ResumeBlock,
  SectionType,
} from '../types'
import { blankBlock, seedApplications, seedResumes } from '../data/seed'
import type { ApplicationStore, ResumeStore } from './types'

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}${Date.now().toString(36)}${idCounter}`
}

/** Deep-ish clone of the seed so edits never mutate the module constants. */
function cloneResume(resume: Resume): Resume {
  return structuredClone(resume)
}

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

  async updateProfile(
    resumeId: string,
    patch: Partial<Resume['profile']>,
  ): Promise<Resume> {
    const resume = this.require(resumeId)
    resume.profile = { ...resume.profile, ...patch }
    return cloneResume(resume)
  }

  async addBlock(resumeId: string, type: SectionType): Promise<Resume> {
    const resume = this.require(resumeId)
    if (!resume.blocks.some((b) => b.type === type)) {
      resume.blocks.push(blankBlock(type, nextId('b')))
    }
    return cloneResume(resume)
  }

  async removeBlock(resumeId: string, blockId: string): Promise<Resume> {
    const resume = this.require(resumeId)
    resume.blocks = resume.blocks.filter((b) => b.id !== blockId)
    return cloneResume(resume)
  }

  async updateBlock(resumeId: string, block: ResumeBlock): Promise<Resume> {
    const resume = this.require(resumeId)
    const index = resume.blocks.findIndex((b) => b.id === block.id)
    if (index !== -1) resume.blocks[index] = structuredClone(block)
    return cloneResume(resume)
  }

  async toggleBlock(
    resumeId: string,
    blockId: string,
    enabled: boolean,
  ): Promise<Resume> {
    const resume = this.require(resumeId)
    const block = resume.blocks.find((b) => b.id === blockId)
    if (block) block.enabled = enabled
    return cloneResume(resume)
  }

  async reorderBlocks(
    resumeId: string,
    fromIndex: number,
    toIndex: number,
  ): Promise<Resume> {
    const resume = this.require(resumeId)
    const max = resume.blocks.length - 1
    if (
      fromIndex < 0 || fromIndex > max ||
      toIndex < 0 || toIndex > max ||
      fromIndex === toIndex
    ) {
      return cloneResume(resume)
    }
    const [moved] = resume.blocks.splice(fromIndex, 1)
    resume.blocks.splice(toIndex, 0, moved)
    return cloneResume(resume)
  }

  private require(resumeId: string): Resume {
    const resume = this.resumes.find((r) => r.id === resumeId)
    if (!resume) throw new Error(`Resume not found: ${resumeId}`)
    return resume
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
