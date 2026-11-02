import { describe, expect, it } from 'vitest'
import { MemoryRateLimiter, type Identity } from './rateLimiter'

const alice: Identity = { key: 'user:alice', kind: 'user' }
const bob: Identity = { key: 'user:bob', kind: 'user' }
const limits = { perDay: 3, perMinute: 2 }
const usage = (costUsd: number) => ({ inputTokens: 1000, outputTokens: 500, costUsd })

function clock(start = 0) {
  let now = start
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

describe('MemoryRateLimiter', () => {
  it('enforces the per-minute limit, then frees up after a minute', async () => {
    const time = clock()
    const limiter = new MemoryRateLimiter(time.now)
    expect((await limiter.tryConsume(alice, 'ats', limits, 10)).status).toBe('ok')
    expect((await limiter.tryConsume(alice, 'ats', limits, 10)).status).toBe('ok')
    expect((await limiter.tryConsume(alice, 'ats', limits, 10)).status).toBe('rate_limited')
    time.advance(61_000)
    expect((await limiter.tryConsume(alice, 'ats', limits, 10)).status).toBe('ok')
  })

  it('enforces the rolling daily limit', async () => {
    const time = clock()
    const limiter = new MemoryRateLimiter(time.now)
    for (let i = 0; i < 3; i++) {
      expect((await limiter.tryConsume(alice, 'assistant', limits, 10)).status).toBe('ok')
      time.advance(61_000)
    }
    expect((await limiter.tryConsume(alice, 'assistant', limits, 10)).status).toBe('rate_limited')
    time.advance(24 * 60 * 60_000)
    expect((await limiter.tryConsume(alice, 'assistant', limits, 10)).status).toBe('ok')
  })

  it('counts each identity separately', async () => {
    const limiter = new MemoryRateLimiter(clock().now)
    await limiter.tryConsume(alice, 'ats', limits, 10)
    await limiter.tryConsume(alice, 'ats', limits, 10)
    expect((await limiter.tryConsume(alice, 'ats', limits, 10)).status).toBe('rate_limited')
    expect((await limiter.tryConsume(bob, 'ats', limits, 10)).status).toBe('ok')
  })

  it('stops everyone once recorded spend reaches the budget', async () => {
    const limiter = new MemoryRateLimiter(clock().now)
    const slot = await limiter.tryConsume(alice, 'ats', limits, 0.01)
    if (slot.status !== 'ok') throw new Error('expected a slot')
    await limiter.record(slot.usageId, usage(0.006))
    await limiter.record(slot.usageId, usage(0.004))
    expect(limiter.totalSpend()).toBeCloseTo(0.01)
    expect((await limiter.tryConsume(bob, 'ats', limits, 0.01)).status).toBe('budget_exhausted')
  })
})
