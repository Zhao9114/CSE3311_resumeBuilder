import type { TokenUsage } from '../ai/model.js'

export type AiRoute = 'ats' | 'assistant'

/** `user:<uuid>` for a verified sign-in, `ip:<hash>` otherwise. */
export interface Identity {
  key: string
  kind: 'user' | 'anon'
}

export interface Limits {
  perDay: number
  perMinute: number
}

export type ConsumeResult =
  | { status: 'ok'; usageId: string }
  | { status: 'rate_limited' }
  | { status: 'budget_exhausted' }

/**
 * Guards every model call. `tryConsume` runs before the call and reserves a
 * slot: it fails if the caller is over their per-minute or rolling 24-hour
 * count, or if total spend has reached the budget. `record` runs after and
 * adds the call's real token cost to that slot, so the budget check on the
 * next request sees it.
 *
 * Rejections cost nothing — the model is never called.
 */
export interface RateLimiter {
  tryConsume(identity: Identity, route: AiRoute, limits: Limits, budgetUsd: number): Promise<ConsumeResult>
  record(usageId: string, usage: TokenUsage): Promise<void>
}

interface Row {
  identity: string
  at: number
  costUsd: number
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * In-process limiter for local development and tests. On Vercel each
 * function instance would keep its own copy, so production uses the
 * Supabase-backed one (supabaseRateLimiter.ts), which shares state.
 */
export class MemoryRateLimiter implements RateLimiter {
  private rows = new Map<string, Row>()
  private seq = 0

  constructor(private now: () => number = Date.now) {}

  async tryConsume(identity: Identity, _route: AiRoute, limits: Limits, budgetUsd: number): Promise<ConsumeResult> {
    const now = this.now()
    let spent = 0
    let lastDay = 0
    let lastMinute = 0
    for (const row of this.rows.values()) {
      spent += row.costUsd
      if (row.identity !== identity.key) continue
      if (now - row.at < DAY) lastDay += 1
      if (now - row.at < MINUTE) lastMinute += 1
    }
    if (spent >= budgetUsd) return { status: 'budget_exhausted' }
    if (lastDay >= limits.perDay || lastMinute >= limits.perMinute) return { status: 'rate_limited' }

    const usageId = String(++this.seq)
    this.rows.set(usageId, { identity: identity.key, at: now, costUsd: 0 })
    return { status: 'ok', usageId }
  }

  async record(usageId: string, usage: TokenUsage): Promise<void> {
    const row = this.rows.get(usageId)
    if (row) row.costUsd += usage.costUsd
  }

  /** For tests and the dev console: total spend so far. */
  totalSpend(): number {
    let spent = 0
    for (const row of this.rows.values()) spent += row.costUsd
    return spent
  }
}
