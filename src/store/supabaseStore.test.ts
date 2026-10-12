import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseResumeStore } from './supabaseStore'
import type { SyncStatus } from './types'

/**
 * The background-save logic in SupabaseResumeStore, run against a tiny fake
 * of the supabase-js query builder (only the calls the store makes). This
 * checks the parts that are easy to get wrong: a new user gets exactly one
 * starter resume, rapid edits collapse into one write of the newest state,
 * and a failed write is retried rather than lost.
 */

type Row = Record<string, unknown>

function fakeClient(opts: { failWrites?: number } = {}) {
  const rows: Row[] = []
  const log: { op: 'insert' | 'update'; row: Row }[] = []
  let failWrites = opts.failWrites ?? 0
  let nextId = 1

  const result = <T,>(data: T, error: { message: string } | null = null) =>
    Promise.resolve({ data, error })

  const client = {
    from(table: string) {
      if (table !== 'resumes') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          order: () => result(rows.map((r) => structuredClone(r))),
        }),
        insert: (row: Row) => {
          const stored = { ...structuredClone(row), id: `uuid-${nextId++}` }
          rows.push(stored)
          log.push({ op: 'insert', row: stored })
          return { select: () => ({ single: () => result(structuredClone(stored)) }) }
        },
        update: (patch: Row) => ({
          eq: (_col: string, id: string) => {
            if (failWrites > 0) {
              failWrites -= 1
              return result(null, { message: 'network down' })
            }
            const target = rows.find((r) => r.id === id)!
            Object.assign(target, structuredClone(patch))
            log.push({ op: 'update', row: structuredClone(target) })
            return result(null)
          },
        }),
      }
    },
  }
  return { client: client as unknown as SupabaseClient, rows, log }
}

describe('SupabaseResumeStore', () => {
  it('creates exactly one starter resume for a new user, even with concurrent first loads', async () => {
    const { client, log } = fakeClient()
    const store = new SupabaseResumeStore(client, 10)

    const [a, b] = await Promise.all([store.list(), store.list()])

    expect(log.filter((l) => l.op === 'insert')).toHaveLength(1)
    expect(a).toHaveLength(1)
    expect(b[0].id).toBe(a[0].id)
    expect(a[0].profile.name).toBe('Your Name') // starter, not the demo person
  })

  it('collapses a burst of edits into one write of the newest state, and the round trip matches', async () => {
    const { client, log, rows } = fakeClient()
    const store = new SupabaseResumeStore(client, 10_000) // never fires on its own
    const [resume] = await store.list()

    for (const name of ['J', 'Jo', 'Jor', 'Jordan']) {
      await store.updateProfile(resume.id, { name })
    }
    await store.reorderBlocks(resume.id, 0, 2)
    expect(log.filter((l) => l.op === 'update')).toHaveLength(0) // nothing sent yet

    await store.flush()

    const updates = log.filter((l) => l.op === 'update')
    expect(updates).toHaveLength(1)
    expect((updates[0].row.profile as Row).name).toBe('Jordan')

    // A fresh store (a page reload) reads back what the last one saved.
    const reloaded = (await new SupabaseResumeStore(client).list())[0]
    expect(reloaded).toEqual(await store.get(resume.id))
    expect(rows).toHaveLength(1)
  })

  it('reports saving → error → saved and retries a failed write', async () => {
    const { client, log } = fakeClient({ failWrites: 1 })
    const store = new SupabaseResumeStore(client, 10_000, 5)
    const seen: SyncStatus[] = []
    store.subscribe((s) => seen.push(s))
    const [resume] = await store.list()

    await store.updateProfile(resume.id, { name: 'Kept' })
    await store.flush() // fails
    expect(store.getSyncStatus()).toBe('error')

    await new Promise((r) => setTimeout(r, 30)) // retry timer fires
    await store.flush()

    expect(seen).toEqual(['saving', 'error', 'saved'])
    const updates = log.filter((l) => l.op === 'update')
    const last = updates[updates.length - 1]
    expect((last.row.profile as Row).name).toBe('Kept')
  })
})
