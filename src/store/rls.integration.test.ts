import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resumeToRow, versionToRow } from './supabaseMappers'
import { seedResume } from '../data/seed'

/**
 * Row-level security, checked against the real database: two signed-in
 * users, and neither can read or change the other's rows.
 *
 * Run with `npm run test:rls`. Needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * (from .env.local) and two existing test accounts in .env.test.local:
 *
 *   RLS_TEST_EMAIL_A=...   RLS_TEST_PASSWORD_A=...
 *   RLS_TEST_EMAIL_B=...   RLS_TEST_PASSWORD_B=...
 *
 * Uses only the public anon key — exactly what a browser has.
 */
const env = import.meta.env
const url = env.VITE_SUPABASE_URL as string | undefined
const key = env.VITE_SUPABASE_ANON_KEY as string | undefined
const configured = Boolean(
  url && key &&
  env.RLS_TEST_EMAIL_A && env.RLS_TEST_PASSWORD_A &&
  env.RLS_TEST_EMAIL_B && env.RLS_TEST_PASSWORD_B,
)

const newClient = () =>
  createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } })

describe.skipIf(!configured)('row-level security', () => {
  // Created in beforeAll: a skipped describe still runs its body, and
  // createClient throws without a URL.
  let alice: SupabaseClient
  let bob: SupabaseClient
  let anon: SupabaseClient
  let aliceResumeId = ''
  let aliceVersionId = ''

  async function signIn(client: SupabaseClient, email: string, password: string) {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  }

  beforeAll(async () => {
    alice = newClient()
    bob = newClient()
    anon = newClient()
    await signIn(alice, env.RLS_TEST_EMAIL_A, env.RLS_TEST_PASSWORD_A)
    await signIn(bob, env.RLS_TEST_EMAIL_B, env.RLS_TEST_PASSWORD_B)

    const resume = await alice
      .from('resumes')
      .insert(resumeToRow({ ...seedResume, title: 'RLS test resume' }))
      .select('id')
      .single()
    if (resume.error) throw new Error(resume.error.message)
    aliceResumeId = resume.data.id

    const version = await alice
      .from('resume_versions')
      .insert(versionToRow({ ...seedResume, id: aliceResumeId }, 'RLS test version'))
      .select('id')
      .single()
    if (version.error) throw new Error(version.error.message)
    aliceVersionId = version.data.id
  })

  afterAll(async () => {
    // Versions are permanent by design; the resume itself can go.
    if (aliceResumeId) await alice.from('resumes').delete().eq('id', aliceResumeId)
  })

  it("the owner can read their own resume", async () => {
    const { data } = await alice.from('resumes').select('id').eq('id', aliceResumeId)
    expect(data).toHaveLength(1)
  })

  it("another user cannot read it", async () => {
    const { data, error } = await bob.from('resumes').select('id').eq('id', aliceResumeId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it("another user cannot change or delete it", async () => {
    const update = await bob
      .from('resumes')
      .update({ title: 'hijacked' })
      .eq('id', aliceResumeId)
      .select('id')
    expect(update.data ?? []).toEqual([])

    const del = await bob.from('resumes').delete().eq('id', aliceResumeId).select('id')
    expect(del.data ?? []).toEqual([])

    const { data } = await alice.from('resumes').select('title').eq('id', aliceResumeId).single()
    expect(data?.title).toBe('RLS test resume')
  })

  it("a user cannot insert a row on someone else's behalf", async () => {
    const { data: me } = await alice.auth.getUser()
    const { error } = await bob
      .from('resumes')
      .insert({ ...resumeToRow(seedResume), user_id: me.user!.id })
    expect(error).not.toBeNull()
  })

  it("another user cannot see the owner's versions", async () => {
    const { data } = await bob.from('resume_versions').select('id').eq('id', aliceVersionId)
    expect(data).toEqual([])
  })

  it("a user cannot link an application to someone else's version", async () => {
    const { error } = await bob.from('applications').insert({
      employer: 'RLS test',
      role: 'n/a',
      status: 'Applied',
      version_id: aliceVersionId,
      applied_at: '2026-10-01',
    })
    expect(error).not.toBeNull()
  })

  it('versions are immutable, even for their owner', async () => {
    const update = await alice
      .from('resume_versions')
      .update({ label: 'edited' })
      .eq('id', aliceVersionId)
      .select('id')
    expect(update.data ?? []).toEqual([])

    const { data } = await alice
      .from('resume_versions')
      .select('label')
      .eq('id', aliceVersionId)
      .single()
    expect(data?.label).toBe('RLS test version')
  })

  it('a signed-out visitor sees nothing at all', async () => {
    for (const table of ['resumes', 'resume_versions', 'applications', 'saved_blocks']) {
      const { data } = await anon.from(table).select('id').limit(1)
      expect(data ?? []).toEqual([])
    }
  })

  // Iteration 3: the AI usage ledger drives rate limits and the spend cap,
  // so no browser session may read it, write to it, or call its functions —
  // otherwise a user could grant themselves a bigger allowance.
  it('no browser session can read or write the AI usage ledger', async () => {
    for (const client of [anon, alice]) {
      const read = await client.from('ai_usage').select('id').limit(1)
      expect(read.data ?? []).toEqual([])

      const write = await client.from('ai_usage').insert({ identity: 'user:forged', route: 'ats', cost_usd: -100 })
      expect(write.error).not.toBeNull()
    }
  })

  it('no browser session can call the limiter functions', async () => {
    for (const client of [anon, alice]) {
      const consume = await client.rpc('ai_try_consume', {
        p_identity: 'user:forged',
        p_route: 'ats',
        p_daily_limit: 1000,
        p_minute_limit: 1000,
        p_budget_usd: 1000,
      })
      expect(consume.error).not.toBeNull()

      const record = await client.rpc('ai_record_usage', {
        p_usage_id: 1,
        p_input_tokens: 0,
        p_output_tokens: 0,
        p_cost_usd: -100,
      })
      expect(record.error).not.toBeNull()
    }
  })
})

describe.skipIf(configured)('row-level security (not configured)', () => {
  it.skip('set RLS_TEST_* in .env.test.local to run these checks', () => {})
})
