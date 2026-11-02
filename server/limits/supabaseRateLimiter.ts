import type { SupabaseClient } from '@supabase/supabase-js'
import type { TokenUsage } from '../ai/model.js'
import type { AiRoute, ConsumeResult, Identity, Limits, RateLimiter } from './rateLimiter.js'

/**
 * Production limiter. State lives in the `ai_usage` table so every function
 * instance sees the same counts and the same running total. The checks run
 * inside `ai_try_consume` (supabase/migrations/0002_iteration3_ai.sql) under
 * a per-identity advisory lock, so two requests from one user can't both
 * slip under the limit.
 *
 * `client` must be created with the service-role key: `ai_usage` has RLS on
 * and no policies, so no browser session can read or write it.
 */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(private client: SupabaseClient) {}

  async tryConsume(identity: Identity, route: AiRoute, limits: Limits, budgetUsd: number): Promise<ConsumeResult> {
    const { data, error } = await this.client.rpc('ai_try_consume', {
      p_identity: identity.key,
      p_route: route,
      p_daily_limit: limits.perDay,
      p_minute_limit: limits.perMinute,
      p_budget_usd: budgetUsd,
    })
    if (error) throw new Error(`ai_try_consume failed: ${error.message}`)
    const row = (Array.isArray(data) ? data[0] : data) as { status?: string; usage_id?: number | null } | null
    switch (row?.status) {
      case 'ok':
        return { status: 'ok', usageId: String(row.usage_id) }
      case 'rate_limited':
        return { status: 'rate_limited' }
      case 'budget_exhausted':
        return { status: 'budget_exhausted' }
      default:
        throw new Error(`ai_try_consume returned an unexpected row: ${JSON.stringify(data)}`)
    }
  }

  async record(usageId: string, usage: TokenUsage): Promise<void> {
    const { error } = await this.client.rpc('ai_record_usage', {
      p_usage_id: Number(usageId),
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_cost_usd: usage.costUsd,
    })
    // The answer is already paid for; losing one ledger row is better than
    // failing the user's request over it.
    if (error) console.error(`ai_record_usage failed for ${usageId}: ${error.message}`)
  }
}
