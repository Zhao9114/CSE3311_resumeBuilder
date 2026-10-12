import { describe, it, expect } from 'vitest'
import {
  applicationFromRow,
  applicationToRow,
  resumeFromRow,
  resumeToRow,
  savedBlockFromRow,
  savedBlockToRow,
  versionFromRow,
  versionToRow,
} from './supabaseMappers'
import { normalizeResume } from './normalize'
import { seedApplications, seedResume } from '../data/seed'
import type { ApplicationDraft } from '../types'

/**
 * Save/load round trip at the database boundary: what we write is what we
 * read back. JSON.parse(JSON.stringify(...)) stands in for the trip through
 * Postgres jsonb, which keeps array order but drops anything non-JSON.
 */
const viaJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

describe('resume row round trip', () => {
  it('reads back exactly the normalized resume, with block order preserved', () => {
    const row = { id: seedResume.id, ...viaJson(resumeToRow(seedResume)) }
    const loaded = resumeFromRow(row)

    expect(loaded).toEqual(normalizeResume(seedResume))
    expect(loaded.blocks.map((b) => b.id)).toEqual(seedResume.blocks.map((b) => b.id))
  })

  it('keeps a reordered and partly hidden resume as it was saved', () => {
    const tailored = structuredClone(seedResume)
    tailored.blocks.reverse()
    tailored.blocks[0].enabled = false
    const loaded = resumeFromRow({ id: tailored.id, ...viaJson(resumeToRow(tailored)) })

    expect(loaded.blocks.map((b) => [b.id, b.enabled])).toEqual(
      tailored.blocks.map((b) => [b.id, b.enabled]),
    )
  })
})

describe('version row round trip', () => {
  it('stores the whole resume in the snapshot and reads it back', () => {
    const row = {
      id: 'ver-1',
      created_at: '2026-10-01T10:00:00.000Z',
      ...viaJson(versionToRow(seedResume, '  Backend-focused ')),
    }
    const version = versionFromRow(row)

    expect(version.label).toBe('Backend-focused')
    expect(version.resumeId).toBe(seedResume.id)
    expect(version.resume).toEqual(normalizeResume(seedResume))
  })
})

describe('application row round trip', () => {
  it.each(seedApplications.map((a) => [a.employer, a] as const))('%s', (_name, app) => {
    const { id, ...draft } = app
    const loaded = applicationFromRow({ id, ...viaJson(applicationToRow(draft)) })
    expect(loaded).toEqual(app)
  })

  it('links to the version id, and an empty one is stored as null', () => {
    const draft: ApplicationDraft = {
      employer: 'Acme',
      role: 'Dev',
      status: 'Applied',
      versionId: '',
      appliedAt: '2026-10-01',
    }
    expect(applicationToRow(draft).version_id).toBeNull()
    expect(applicationToRow({ ...draft, versionId: 'v9' }).version_id).toBe('v9')
  })
})

describe('saved block row round trip', () => {
  it('stores the block without an id and reads it back intact', () => {
    const { id: _id, ...block } = seedResume.blocks[1]
    void _id
    const row = savedBlockToRow({ name: 'Experience — Backend', tags: ['backend', ' '], block })
    expect(Object.keys(row.block as object)).not.toContain('id')

    const loaded = savedBlockFromRow({ id: 'lib1', saved_at: '2026-10-01', ...viaJson(row) })
    expect(loaded?.block).toEqual(block)
    expect(loaded?.tags).toEqual(['backend'])
  })
})
