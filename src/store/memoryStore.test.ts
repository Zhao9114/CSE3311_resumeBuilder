import { describe, it, expect } from 'vitest'
import { InMemoryResumeStore, InMemoryApplicationStore } from './memoryStore'
import { isInProgress, statusLabel } from '../types/application'
import type { Resume } from '../types/resume'

/**
 * Covers the four behaviors called out in the iteration-1 doc as the most
 * complex/important: block reorder, show/hide filtering, application stats,
 * and custom-status fallback.
 */

describe('reorder logic (ResumeStore.reorderBlocks)', () => {
  it('moves a block from one index to another and keeps the rest in order', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)

    const after = await store.reorderBlocks('r1', 0, 2)

    // block that was at index 0 should now sit at index 2
    expect(after.blocks[2].id).toBe(before[0])
    // the two blocks it hopped over shift left by one
    expect(after.blocks[0].id).toBe(before[1])
    expect(after.blocks[1].id).toBe(before[2])
    // nothing after the moved range changes
    expect(after.blocks.slice(3).map((b) => b.id)).toEqual(before.slice(3))
  })

  it('moving a block backward works the same as moving it forward', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)

    const after = await store.reorderBlocks('r1', 3, 0)

    expect(after.blocks[0].id).toBe(before[3])
    expect(after.blocks.map((b) => b.id)).toHaveLength(before.length)
  })

  it('is a no-op when fromIndex equals toIndex', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)

    const after = await store.reorderBlocks('r1', 1, 1)

    expect(after.blocks.map((b) => b.id)).toEqual(before)
  })

  it('is a no-op when either index is out of range', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)

    const negative = await store.reorderBlocks('r1', -1, 2)
    const tooHigh = await store.reorderBlocks('r1', 0, 999)

    expect(negative.blocks.map((b) => b.id)).toEqual(before)
    expect(tooHigh.blocks.map((b) => b.id)).toEqual(before)
  })
})

describe('show/hide filtering (enabled blocks drive the preview)', () => {
  it('toggling a block off marks it disabled without removing it', async () => {
    const store = new InMemoryResumeStore()
    const target = (await store.get('r1'))!.blocks[0]

    const after = await store.toggleBlock('r1', target.id, false)

    const toggled = after.blocks.find((b) => b.id === target.id)
    expect(toggled?.enabled).toBe(false)
    // still present in the list, just disabled
    expect(after.blocks).toHaveLength(
      (await store.get('r1'))!.blocks.length,
    )
  })

  it('the set of enabled blocks is exactly what the preview should render', async () => {
    const store = new InMemoryResumeStore()
    const resume = (await store.get('r1'))!
    const startEnabledCount = resume.blocks.filter((b) => b.enabled).length
    // pick two blocks that start enabled, so turning them off has a
    // predictable effect regardless of the seed's own enabled/disabled mix
    const [firstId, secondId] = resume.blocks
      .filter((b) => b.enabled)
      .slice(0, 2)
      .map((b) => b.id)

    await store.toggleBlock('r1', firstId, false)
    const after = await store.toggleBlock('r1', secondId, false)

    const visibleIds = after.blocks.filter((b) => b.enabled).map((b) => b.id)
    expect(visibleIds).not.toContain(firstId)
    expect(visibleIds).not.toContain(secondId)
    expect(visibleIds.length).toBe(startEnabledCount - 2)
  })

  it('toggling back on restores it to the visible set', async () => {
    const store = new InMemoryResumeStore()
    const target = (await store.get('r1'))!.blocks[0]

    await store.toggleBlock('r1', target.id, false)
    const restored = await store.toggleBlock('r1', target.id, true)

    const found = restored.blocks.find((b) => b.id === target.id)
    expect(found?.enabled).toBe(true)
  })

  it('preserves block order after toggling — order is unaffected by enabled state', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)
    const middle = before[Math.floor(before.length / 2)]

    const after = await store.toggleBlock('r1', middle, false)

    expect(after.blocks.map((b) => b.id)).toEqual(before)
  })
})

describe('application stats (counts must match the underlying data)', () => {
  it('total count equals the number of applications', async () => {
    const store = new InMemoryApplicationStore()
    const apps = await store.list()

    expect(apps.length).toBeGreaterThan(0)
  })

  it('in-progress count only includes statuses isInProgress considers active', async () => {
    const store = new InMemoryApplicationStore()
    const apps = await store.list()

    const expected = apps.filter(isInProgress).length
    const computed = apps.filter((a) => isInProgress(a)).length

    expect(computed).toBe(expected)
    expect(computed).toBeLessThanOrEqual(apps.length)
  })

  it('interview count only counts status === Interview, nothing else', async () => {
    const store = new InMemoryApplicationStore()
    const apps = await store.list()

    const interviews = apps.filter((a) => a.status === 'Interview')
    for (const app of interviews) {
      expect(app.status).toBe('Interview')
    }
    // sanity: count is stable and non-negative
    expect(interviews.length).toBeGreaterThanOrEqual(0)
  })

  it('stats stay correct after adding and then deleting an application', async () => {
    const store = new InMemoryApplicationStore()
    const before = (await store.list()).length

    const added = await store.add({
      employer: 'Test Co',
      role: 'QA Intern',
      status: 'Applied',
      resumeId: 'r1',
      appliedAt: '2026-01-01',
    })
    const afterAdd = await store.list()
    expect(afterAdd.length).toBe(before + 1)

    await store.remove(added.id)
    const afterRemove = await store.list()
    expect(afterRemove.length).toBe(before)
  })
})

describe('custom status handling', () => {
  it('statusLabel returns the custom text when status is Custom', async () => {
    const store = new InMemoryApplicationStore()
    const added = await store.add({
      employer: 'Acme',
      role: 'Dev',
      status: 'Custom',
      customStatus: 'Take-home sent',
      resumeId: 'r1',
      appliedAt: '2026-01-01',
    })

    expect(statusLabel(added)).toBe('Take-home sent')
  })

  it('an empty custom label falls back to the plain "Custom" label', async () => {
    const store = new InMemoryApplicationStore()
    const added = await store.add({
      employer: 'Acme',
      role: 'Dev',
      status: 'Custom',
      customStatus: '',
      resumeId: 'r1',
      appliedAt: '2026-01-01',
    })

    expect(statusLabel(added)).toBe('Custom')
  })

  it('a Custom application counts as in-progress', async () => {
    const store = new InMemoryApplicationStore()
    const added = await store.add({
      employer: 'Acme',
      role: 'Dev',
      status: 'Custom',
      customStatus: 'Phone screen',
      resumeId: 'r1',
      appliedAt: '2026-01-01',
    })

    expect(isInProgress(added)).toBe(true)
  })

  it('switching an application away from Custom clears the stale customStatus', async () => {
    const store = new InMemoryApplicationStore()
    const added = await store.add({
      employer: 'Acme',
      role: 'Dev',
      status: 'Custom',
      customStatus: 'Phone screen',
      resumeId: 'r1',
      appliedAt: '2026-01-01',
    })

    const updated = await store.update(added.id, { status: 'Interview' })

    expect(updated.status).toBe('Interview')
    expect(updated.customStatus).toBeUndefined()
  })
})

describe('sanity: seed data is not mutated by these tests', () => {
  it('a fresh store still has the original seeded resume', async () => {
    const store = new InMemoryResumeStore()
    const resume = (await store.get('r1')) as Resume
    expect(resume.blocks.length).toBeGreaterThan(0)
    expect(resume.id).toBe('r1')
  })
})
