import type {
  Application,
  ApplicationDraft,
  Resume,
  ResumeBlock,
  ResumeVersion,
  SavedBlock,
  SavedBlockDraft,
} from '../types'
import {
  normalizeApplication,
  normalizeBlock,
  normalizeResume,
  parseBlock,
  parseBlocks,
  parseProfile,
  parseResume,
  parseStatus,
  parseTemplateId,
} from './normalize'

/**
 * Row ↔ domain conversion for the Supabase tables in
 * supabase/migrations/0001_iteration2.sql.
 *
 * Kept apart from the store so the round trip can be unit-tested without a
 * database: everything written goes through `normalize*`, everything read
 * goes through `parse*`. `user_id` never appears here — the database fills
 * it from the caller's session, so the browser can't claim another user's id.
 */

export interface ResumeRow {
  id: string
  title: string
  template_id: string
  profile: unknown
  blocks: unknown
}

export interface ResumeVersionRow {
  id: string
  resume_id: string | null
  label: string
  snapshot: unknown
  created_at: string
}

export interface ApplicationRow {
  id: string
  employer: string
  role: string
  status: string
  custom_status: string | null
  version_id: string | null
  applied_at: string
}

export interface SavedBlockRow {
  id: string
  name: string
  tags: string[] | null
  block: unknown
  saved_at: string
}

// ─── resumes ────────────────────────────────────────────────────────────────

export function resumeToRow(resume: Resume): Omit<ResumeRow, 'id'> {
  const clean = normalizeResume(resume)
  return {
    title: clean.title,
    template_id: clean.templateId,
    profile: clean.profile,
    blocks: clean.blocks,
  }
}

export function resumeFromRow(row: ResumeRow): Resume {
  return {
    id: row.id,
    title: row.title || 'My resume',
    templateId: parseTemplateId(row.template_id),
    profile: parseProfile(row.profile),
    blocks: parseBlocks(row.blocks),
  }
}

// ─── resume_versions ────────────────────────────────────────────────────────

export function versionToRow(
  resume: Resume,
  label: string,
): Omit<ResumeVersionRow, 'id' | 'created_at'> {
  return {
    resume_id: resume.id || null,
    label: label.trim() || 'Untitled version',
    snapshot: normalizeResume(resume),
  }
}

export function versionFromRow(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    resumeId: row.resume_id,
    label: row.label,
    createdAt: row.created_at,
    resume: parseResume(row.snapshot, row.resume_id ?? ''),
  }
}

// ─── applications ───────────────────────────────────────────────────────────

export function applicationToRow(draft: ApplicationDraft): Omit<ApplicationRow, 'id'> {
  const clean = normalizeApplication(draft)
  return {
    employer: clean.employer,
    role: clean.role,
    status: clean.status,
    custom_status: clean.customStatus ?? null,
    version_id: clean.versionId,
    applied_at: clean.appliedAt,
  }
}

export function applicationFromRow(row: ApplicationRow): Application {
  const status = parseStatus(row.status)
  const app: Application = {
    id: row.id,
    employer: row.employer,
    role: row.role,
    status,
    versionId: row.version_id,
    appliedAt: row.applied_at,
  }
  if (status === 'Custom' && row.custom_status) app.customStatus = row.custom_status
  return app
}

// ─── saved_blocks ───────────────────────────────────────────────────────────

export function savedBlockToRow(draft: SavedBlockDraft): Omit<SavedBlockRow, 'id' | 'saved_at'> {
  // Blocks are stored without an id; normalizeBlock needs one, so lend it a
  // throwaway and strip it again.
  const { id: _unused, ...block } = normalizeBlock({ ...draft.block, id: '' } as ResumeBlock)
  void _unused
  return {
    name: draft.name.trim() || 'Saved block',
    tags: draft.tags.map((tag) => tag.trim()).filter((tag) => tag !== ''),
    block,
  }
}

export function savedBlockFromRow(row: SavedBlockRow): SavedBlock | null {
  const parsed = parseBlock({ ...(row.block as object), id: 'tmp' })
  if (!parsed) return null
  const { id: _unused, ...block } = parsed
  void _unused
  return {
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    block,
    savedAt: row.saved_at,
  }
}
