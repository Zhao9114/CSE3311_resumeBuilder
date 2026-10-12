import { describe, it, expect } from 'vitest'
import {
  InMemoryApplicationStore,
  InMemoryResumeStore,
  InMemoryResumeVersionStore,
} from './memoryStore'
import { resumeUsedLabel, isInProgress, statusLabel } from '../types'
import type { ResumeBlock } from '../types'

/**
 * Iteration 2's core promise: a version is a frozen record of what was sent,
 * and the tracker's "Resume used" column resolves to that frozen record —
 * never to the live resume, which keeps changing.
 */

async function freshStores() {
  return {
    resumes: new InMemoryResumeStore(),
    versions: new InMemoryResumeVersionStore([]),
    applications: new InMemoryApplicationStore([]),
  }
}

describe('ResumeStore save/load round trip', () => {
  it('get() returns exactly what save() stored, and callers cannot mutate it afterwards', async () => {
    const { resumes } = await freshStores()
    const original = (await resumes.get('r1'))!
    const edited = { ...original, title: 'Edited', blocks: [...original.blocks].reverse() }

    await resumes.save(edited)
    expect(await resumes.get('r1')).toEqual(edited)

    edited.blocks.pop() // mutating our copy must not reach into the store
    expect((await resumes.get('r1'))!.blocks).toHaveLength(original.blocks.length)
  })
})

describe('snapshot immutability', () => {
  it('editing the live resume after a snapshot leaves the version unchanged', async () => {
    const { resumes, versions } = await freshStores()
    const live = (await resumes.get('r1'))!
    const version = await versions.snapshot(live, 'Sent to Stripe')
    const frozen = structuredClone(version.resume)

    // Every kind of edit the editor can make:
    await resumes.reorderBlocks('r1', 0, 3)
    await resumes.toggleBlock('r1', live.blocks[1].id, false)
    await resumes.updateProfile('r1', { name: 'Someone Else' })
    const summary = (await resumes.get('r1'))!.blocks.find((b) => b.type === 'summary')!
    await resumes.updateBlock('r1', { ...summary, data: { text: 'Rewritten' } } as ResumeBlock)
    await resumes.addBlock('r1', 'custom', 'Awards')

    const reloaded = await versions.get(version.id)
    expect(reloaded?.resume).toEqual(frozen)
    expect((await resumes.get('r1'))!.profile.name).toBe('Someone Else') // live did change
  })

  it('mutating the object passed in, or a version read back, does not change the stored version', async () => {
    const { resumes, versions } = await freshStores()
    const live = (await resumes.get('r1'))!
    const version = await versions.snapshot(live, 'v1')

    live.profile.name = 'Changed after snapshot'
    version.resume.blocks.length = 0
    const listed = await versions.list()
    listed[0].label = 'tampered'

    const reloaded = (await versions.get(version.id))!
    expect(reloaded.label).toBe('v1')
    expect(reloaded.resume.profile.name).toBe('Jordan Avery Chen')
    expect(reloaded.resume.blocks.length).toBeGreaterThan(0)
  })

  it('lists newest first and can filter by resume', async () => {
    const { resumes, versions } = await freshStores()
    const live = (await resumes.get('r1'))!
    const first = await versions.snapshot(live, 'first')
    await new Promise((r) => setTimeout(r, 2))
    const second = await versions.snapshot(live, 'second')

    expect((await versions.list()).map((v) => v.id)).toEqual([second.id, first.id])
    expect(await versions.list('other-resume')).toEqual([])
  })
})

describe('tracker "Resume used" resolution', () => {
  it('resolves each application to the version it was sent with, even after the resume moves on', async () => {
    const { resumes, versions, applications } = await freshStores()

    const live = (await resumes.get('r1'))!
    const backend = await versions.snapshot(live, 'Backend-focused')
    await resumes.updateProfile('r1', { title: 'Frontend Engineer' })
    const frontend = await versions.snapshot((await resumes.get('r1'))!, 'Frontend-focused')

    await applications.add({ employer: 'Stripe', role: 'Backend', status: 'Applied', versionId: backend.id, appliedAt: '2026-10-01' })
    await applications.add({ employer: 'Figma', role: 'Frontend', status: 'Applied', versionId: frontend.id, appliedAt: '2026-10-02' })

    // The live resume keeps changing after both were sent.
    await resumes.updateProfile('r1', { title: 'Data Engineer' })

    const all = await versions.list()
    const byEmployer = Object.fromEntries(
      (await applications.list()).map((a) => [a.employer, a]),
    )
    expect(resumeUsedLabel(byEmployer.Stripe, all)).toBe('Backend-focused')
    expect(resumeUsedLabel(byEmployer.Figma, all)).toBe('Frontend-focused')

    // And the version the app points at still holds what was sent.
    const sent = all.find((v) => v.id === byEmployer.Stripe.versionId)!
    expect(sent.resume.profile.title).toBe('Software Engineer')
  })

  it('shows a dash when no version was recorded, and flags an id it cannot find', () => {
    expect(resumeUsedLabel({ versionId: null }, [])).toBe('—')
    expect(resumeUsedLabel({ versionId: 'gone' }, [])).toBe('Unknown version')
  })

  it('editing an application to point at a different version re-resolves the label', async () => {
    const { resumes, versions, applications } = await freshStores()
    const live = (await resumes.get('r1'))!
    const a = await versions.snapshot(live, 'A')
    const b = await versions.snapshot(live, 'B')
    const app = await applications.add({ employer: 'X', role: 'Y', status: 'Applied', versionId: a.id, appliedAt: '2026-10-01' })

    const updated = await applications.update(app.id, { versionId: b.id })
    expect(resumeUsedLabel(updated, await versions.list())).toBe('B')
  })
})

describe('seeded demo data after the versionId change', () => {
  it('every seeded application resolves to a seeded version', async () => {
    const versions = await new InMemoryResumeVersionStore().list()
    const apps = await new InMemoryApplicationStore().list()
    for (const app of apps) {
      expect(['—', 'Unknown version']).not.toContain(resumeUsedLabel(app, versions))
    }
  })

  it('stats and custom-status fallback still hold', async () => {
    const apps = await new InMemoryApplicationStore().list()
    expect(apps.filter(isInProgress)).toHaveLength(4)
    expect(apps.filter((a) => a.status === 'Interview')).toHaveLength(1)
    expect(apps.filter((a) => a.status === 'Accepted')).toHaveLength(1)
    expect(statusLabel({ ...apps[0], status: 'Custom', customStatus: '' })).toBe('Custom')
  })
})
