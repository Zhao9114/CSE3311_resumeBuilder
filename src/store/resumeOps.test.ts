import { describe, expect, it } from 'vitest'
import { seedResume } from '../data/seed'
import type { ResumeBlock } from '../types'
import { addBlock, insertBlock, moveItem } from './resumeOps'

const labels = (r: { blocks: { label: string }[] }) => r.blocks.map((b) => b.label)
const last = (list: string[]) => list[list.length - 1]

describe('addBlock / insertBlock at a position (drag-and-drop inserts)', () => {
  const custom: Omit<ResumeBlock, 'id'> = { type: 'custom', label: 'Awards', enabled: true, data: { items: [] } }

  it('places the block at the given index', () => {
    const next = insertBlock(seedResume, custom, 1)
    expect(labels(next)[1]).toBe('Awards')
    expect(next.blocks).toHaveLength(seedResume.blocks.length + 1)
  })

  it('accepts the end of the list as a position', () => {
    const next = insertBlock(seedResume, custom, seedResume.blocks.length)
    expect(last(labels(next))).toBe('Awards')
  })

  it('appends when the index is missing or out of range', () => {
    for (const at of [undefined, -1, 99, 1.5]) {
      expect(last(labels(insertBlock(seedResume, custom, at)))).toBe('Awards')
    }
  })

  it('gives the copy a fresh id and leaves the input alone', () => {
    const before = structuredClone(seedResume)
    const next = insertBlock(seedResume, { ...custom }, 0)
    expect(seedResume).toEqual(before)
    expect(seedResume.blocks.map((b) => b.id)).not.toContain(next.blocks[0].id)
  })

  it('still refuses a second copy of a built-in section, wherever it is dropped', () => {
    const next = addBlock(seedResume, 'summary', undefined, 0)
    expect(next.blocks.filter((b) => b.type === 'summary')).toHaveLength(1)
  })

  it('adds a custom section at the index', () => {
    const next = addBlock(seedResume, 'custom', 'Volunteering', 2)
    expect(labels(next)[2]).toBe('Volunteering')
  })
})

describe('moveItem (reordering inside a section)', () => {
  it('moves an entry down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('treats bad indexes as a no-op copy', () => {
    const list = ['a', 'b']
    for (const [from, to] of [[0, 0], [-1, 1], [0, 5], [2, 0]]) {
      const out = moveItem(list, from, to)
      expect(out).toEqual(list)
      expect(out).not.toBe(list)
    }
  })

  it('never mutates its input', () => {
    const list = Object.freeze(['a', 'b', 'c'])
    expect(() => moveItem(list, 0, 2)).not.toThrow()
    expect(list).toEqual(['a', 'b', 'c'])
  })
})
