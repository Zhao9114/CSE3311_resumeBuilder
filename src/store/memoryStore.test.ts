import { describe, it, expect } from 'vitest'
import { InMemoryResumeStore, InMemoryApplicationStore } from './memoryStore'
import { isInProgress, statusLabel } from '../types/application'

/**
 * One test per behavior called out in the iteration-1 doc as most in need
 * of coverage: block reorder, show/hide filtering, application stats, and
 * custom-status fallback.
 */

describe('ResumeStore.reorderBlocks', () => {
  it('moves a block to its new index and shifts the rest without losing any', async () => {
    const store = new InMemoryResumeStore()
    const before = (await store.get('r1'))!.blocks.map((b) => b.id)

    const after = await store.reorderBlocks('r1', 0, 2)

    expect(after.blocks[2].id).toBe(before[0]) // moved block lands at index 2
    expect(after.blocks[0].id).toBe(before[1]) // others shift left by one
    expect(after.blocks.map((b) => b.id).sort()).toEqual([...before].sort()) // nothing lost
  })
})

describe('ResumeStore.toggleBlock (show/hide)', () => {
  it('disabling a block removes it from the enabled set the preview renders, without deleting it', async () => {
    const store = new InMemoryResumeStore()
    const resume = (await store.get('r1'))!
    const target = resume.blocks.find((b) => b.enabled)!
    const enabledBefore = resume.blocks.filter((b) => b.enabled).length

    const after = await store.toggleBlock('r1', target.id, false)

    expect(after.blocks).toHaveLength(resume.blocks.length) // still present
    expect(after.blocks.find((b) => b.id === target.id)?.enabled).toBe(false)
    expect(after.blocks.filter((b) => b.enabled)).toHaveLength(enabledBefore - 1)
  })
})

describe('application stats', () => {
  it('in-progress count matches isInProgress and updates after add/remove', async () => {
    const store = new InMemoryApplicationStore()
    const before = await store.list()
    const inProgressBefore = before.filter(isInProgress).length

    const added = await store.add({
      employer: 'Test Co',
      role: 'QA Intern',
      status: 'Applied', // counts as in-progress
      versionId: 'v1',
      appliedAt: '2026-01-01',
    })
    const afterAdd = await store.list()
    expect(afterAdd.filter(isInProgress)).toHaveLength(inProgressBefore + 1)

    await store.remove(added.id)
    const afterRemove = await store.list()
    expect(afterRemove.filter(isInProgress)).toHaveLength(inProgressBefore)
  })
})

describe('custom status handling', () => {
  it('empty custom text falls back to "Custom", and switching away clears it', async () => {
    const store = new InMemoryApplicationStore()
    const added = await store.add({
      employer: 'Acme',
      role: 'Dev',
      status: 'Custom',
      customStatus: '',
      versionId: 'v1',
      appliedAt: '2026-01-01',
    })
    expect(statusLabel(added)).toBe('Custom')

    const updated = await store.update(added.id, { status: 'Interview' })
    expect(updated.customStatus).toBeUndefined()
  })
})
