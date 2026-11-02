import type { SupabaseClient } from '@supabase/supabase-js'
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
import { starterResume } from '../data/seed'
import * as ops from './resumeOps'
import { cloneResume } from './resumeOps'
import {
  applicationFromRow,
  applicationToRow,
  resumeFromRow,
  resumeToRow,
  savedBlockFromRow,
  savedBlockToRow,
  versionFromRow,
  versionToRow,
  type ApplicationRow,
  type ResumeRow,
  type ResumeVersionRow,
  type SavedBlockRow,
} from './supabaseMappers'
import type {
  ApplicationStore,
  BlockLibraryStore,
  ResumeStore,
  ResumeVersionStore,
  SyncStatus,
  SyncStatusSource,
} from './types'

/**
 * Supabase-backed stores. Each one implements the same interface as its
 * in-memory twin, so no component knows which it is talking to.
 *
 * None of these send `user_id`. The column defaults to `auth.uid()` and
 * row-level security filters every query to the signed-in user's rows, so
 * "only my data" is enforced by the database, not by this code.
 */

const RESUME_COLUMNS = 'id, title, template_id, profile, blocks'
const VERSION_COLUMNS = 'id, resume_id, label, snapshot, created_at'
const APPLICATION_COLUMNS = 'id, employer, role, status, custom_status, version_id, applied_at'
const SAVED_BLOCK_COLUMNS = 'id, name, tags, block, saved_at'

/** Supabase returns plain objects, not Error instances; keep the message. */
function fail(error: { message: string }, action: string): never {
  throw new Error(`Couldn't ${action}: ${error.message}`)
}

/**
 * Resumes save in the background.
 *
 * `updateBlock` and `updateProfile` fire on every keystroke. Awaiting a
 * network round trip per key would make typing lag, and responses arriving
 * out of order could put an older resume back on screen. So each edit is
 * applied to a local cache with the same pure functions the in-memory store
 * uses (`resumeOps`) and returned at once; the whole row is then written
 * after a short pause in typing.
 *
 * Writes go through one promise chain, so they reach the database in order,
 * and each write reads the cache when it runs — the newest state always wins.
 * A failed write keeps the resume marked dirty and retries.
 */
export class SupabaseResumeStore implements ResumeStore, SyncStatusSource {
  private cache = new Map<string, Resume>()
  private loading: Promise<void> | null = null
  private dirty = new Set<string>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private queue: Promise<void> = Promise.resolve()
  private status: SyncStatus = 'idle'
  private listeners = new Set<(status: SyncStatus) => void>()

  constructor(
    private readonly client: SupabaseClient,
    private readonly debounceMs = 600,
    private readonly retryMs = 5000,
  ) {}

  async list(): Promise<Resume[]> {
    await this.load()
    return [...this.cache.values()].map(cloneResume)
  }

  async get(id: string): Promise<Resume | undefined> {
    await this.load()
    const found = this.cache.get(id)
    return found ? cloneResume(found) : undefined
  }

  /**
   * Replaces a whole resume, e.g. when restoring a version. An unknown id
   * inserts a new row, and the database assigns the real id.
   */
  async save(resume: Resume): Promise<Resume> {
    await this.load()
    if (this.cache.has(resume.id)) {
      this.cache.set(resume.id, cloneResume(resume))
      this.markDirty(resume.id)
      return cloneResume(resume)
    }
    const { data, error } = await this.client
      .from('resumes')
      .insert(resumeToRow(resume))
      .select(RESUME_COLUMNS)
      .single()
    if (error) fail(error, 'create the resume')
    const created = resumeFromRow(data as ResumeRow)
    this.cache.set(created.id, created)
    return cloneResume(created)
  }

  updateProfile(resumeId: string, patch: Partial<Resume['profile']>): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.updateProfile(r, patch))
  }

  setTemplate(resumeId: string, templateId: TemplateId): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.setTemplate(r, templateId))
  }

  addBlock(resumeId: string, type: SectionType, title?: string, atIndex?: number): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.addBlock(r, type, title, atIndex))
  }

  insertBlock(resumeId: string, block: Omit<ResumeBlock, 'id'>, atIndex?: number): Promise<Resume> {
    return this.apply(resumeId, (r) => ops.insertBlock(r, block, atIndex))
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

  // ─── SyncStatusSource ─────────────────────────────────────────────────────

  getSyncStatus(): SyncStatus {
    return this.status
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Writes everything pending now, without waiting for the debounce. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const ids = [...this.dirty]
    this.dirty.clear()
    if (ids.length > 0) this.queue = this.queue.then(() => this.write(ids))
    return this.queue
  }

  /** True while there are edits the database hasn't seen yet. */
  hasPendingWrites(): boolean {
    return this.dirty.size > 0 || this.status === 'saving'
  }

  // ─── internals ────────────────────────────────────────────────────────────

  /**
   * Loads the user's resumes once and memoises the promise, so StrictMode's
   * double-run effects and the builder and tracker mounting together all
   * share a single request — and a brand-new user gets exactly one starter.
   */
  private load(): Promise<void> {
    if (!this.loading) {
      this.loading = this.fetchAll()
      // A failed load shouldn't stick; let the next call try again.
      this.loading.catch(() => {
        this.loading = null
      })
    }
    return this.loading
  }

  private async fetchAll(): Promise<void> {
    const { data, error } = await this.client
      .from('resumes')
      .select(RESUME_COLUMNS)
      .order('created_at', { ascending: true })
    if (error) fail(error, 'load your resumes')

    let rows = (data ?? []) as ResumeRow[]
    if (rows.length === 0) {
      // First sign-in: give the user their own blank starter resume.
      const { data: created, error: createError } = await this.client
        .from('resumes')
        .insert(resumeToRow({ ...starterResume(), id: '' }))
        .select(RESUME_COLUMNS)
        .single()
      if (createError) fail(createError, 'create your first resume')
      rows = [created as ResumeRow]
    }
    for (const row of rows) this.cache.set(row.id, resumeFromRow(row))
  }

  private async apply(resumeId: string, op: (r: Resume) => Resume): Promise<Resume> {
    await this.load()
    const current = this.cache.get(resumeId)
    if (!current) throw new Error(`Resume not found: ${resumeId}`)
    const next = op(current)
    this.cache.set(resumeId, next)
    this.markDirty(resumeId)
    return cloneResume(next)
  }

  private markDirty(resumeId: string): void {
    this.dirty.add(resumeId)
    this.setStatus('saving')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), this.debounceMs)
  }

  private async write(ids: string[]): Promise<void> {
    try {
      for (const id of ids) {
        const resume = this.cache.get(id)
        if (!resume) continue
        const { error } = await this.client
          .from('resumes')
          .update(resumeToRow(resume))
          .eq('id', id)
        if (error) fail(error, 'save your resume')
      }
      if (this.dirty.size === 0) this.setStatus('saved')
    } catch {
      // Never reject the queue — later writes must still run. Keep the
      // resumes dirty and try again shortly.
      ids.forEach((id) => this.dirty.add(id))
      this.setStatus('error')
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => void this.flush(), this.retryMs)
    }
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.status) return
    this.status = status
    this.listeners.forEach((listener) => listener(status))
  }
}

/**
 * Versions are insert-only. The table has no UPDATE or DELETE policy and a
 * trigger that rejects updates, so once written a snapshot is fixed.
 */
export class SupabaseResumeVersionStore implements ResumeVersionStore {
  constructor(private readonly client: SupabaseClient) {}

  async snapshot(resume: Resume, label: string): Promise<ResumeVersion> {
    // Snapshot what the user sees, passed in from the editor, rather than
    // re-reading the row: the resume store may still have a write pending.
    const { data, error } = await this.client
      .from('resume_versions')
      .insert(versionToRow(resume, label))
      .select(VERSION_COLUMNS)
      .single()
    if (error) fail(error, 'save the version')
    return versionFromRow(data as ResumeVersionRow)
  }

  async list(resumeId?: string): Promise<ResumeVersion[]> {
    let query = this.client
      .from('resume_versions')
      .select(VERSION_COLUMNS)
      .order('created_at', { ascending: false })
    if (resumeId !== undefined) query = query.eq('resume_id', resumeId)
    const { data, error } = await query
    if (error) fail(error, 'load your versions')
    return ((data ?? []) as ResumeVersionRow[]).map(versionFromRow)
  }

  async get(id: string): Promise<ResumeVersion | undefined> {
    const { data, error } = await this.client
      .from('resume_versions')
      .select(VERSION_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'load the version')
    return data ? versionFromRow(data as ResumeVersionRow) : undefined
  }
}

export class SupabaseApplicationStore implements ApplicationStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Application[]> {
    const { data, error } = await this.client
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .order('created_at', { ascending: false })
    if (error) fail(error, 'load your applications')
    return ((data ?? []) as ApplicationRow[]).map(applicationFromRow)
  }

  async add(draft: ApplicationDraft): Promise<Application> {
    const { data, error } = await this.client
      .from('applications')
      .insert(applicationToRow(draft))
      .select(APPLICATION_COLUMNS)
      .single()
    if (error) fail(error, 'add the application')
    return applicationFromRow(data as ApplicationRow)
  }

  async update(id: string, patch: Partial<ApplicationDraft>): Promise<Application> {
    // Merge onto the stored row first so validation sees the whole record —
    // e.g. moving off 'Custom' must clear the old custom label.
    const { data: current, error: readError } = await this.client
      .from('applications')
      .select(APPLICATION_COLUMNS)
      .eq('id', id)
      .single()
    if (readError) fail(readError, 'load the application')
    const { id: _id, ...existing } = applicationFromRow(current as ApplicationRow)
    void _id
    const merged: ApplicationDraft = { ...existing, ...patch }
    if (merged.status !== 'Custom') delete merged.customStatus

    const { data, error } = await this.client
      .from('applications')
      .update(applicationToRow(merged))
      .eq('id', id)
      .select(APPLICATION_COLUMNS)
      .single()
    if (error) fail(error, 'update the application')
    return applicationFromRow(data as ApplicationRow)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('applications').delete().eq('id', id)
    if (error) fail(error, 'delete the application')
  }
}

export class SupabaseBlockLibraryStore implements BlockLibraryStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<SavedBlock[]> {
    const { data, error } = await this.client
      .from('saved_blocks')
      .select(SAVED_BLOCK_COLUMNS)
      .order('saved_at', { ascending: false })
    if (error) fail(error, 'load your saved blocks')
    return ((data ?? []) as SavedBlockRow[])
      .map(savedBlockFromRow)
      .filter((b): b is SavedBlock => b !== null)
  }

  async save(draft: SavedBlockDraft): Promise<SavedBlock> {
    const { data, error } = await this.client
      .from('saved_blocks')
      .insert(savedBlockToRow(draft))
      .select(SAVED_BLOCK_COLUMNS)
      .single()
    if (error) fail(error, 'save the block')
    const saved = savedBlockFromRow(data as SavedBlockRow)
    if (!saved) throw new Error("Couldn't save the block: it was not a valid section")
    return saved
  }

  async rename(id: string, name: string): Promise<SavedBlock> {
    const { data, error } = await this.client
      .from('saved_blocks')
      .update({ name: name.trim() || 'Saved block' })
      .eq('id', id)
      .select(SAVED_BLOCK_COLUMNS)
      .single()
    if (error) fail(error, 'rename the block')
    const saved = savedBlockFromRow(data as SavedBlockRow)
    if (!saved) throw new Error(`Saved block not found: ${id}`)
    return saved
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('saved_blocks').delete().eq('id', id)
    if (error) fail(error, 'delete the block')
  }
}
