import Anthropic from '@anthropic-ai/sdk'
import { addUsage, NO_USAGE, type Model, type TokenUsage } from '../ai/model.js'
import type { AiDeps } from '../deps.js'
import { apiError } from '../http.js'
import { resolveIdentity } from '../limits/identity.js'
import type { AiRoute } from '../limits/rateLimiter.js'

export interface GuardedCall {
  model: Model
  /** Add a model call's usage to this request's ledger row. */
  charge: (usage: TokenUsage) => void
}

/**
 * Wraps a handler body that calls the model. In order:
 *
 *  1. AI switched off (no key) → 503, nothing else happens.
 *  2. Work out who is asking and reserve a slot with the limiter; over the
 *     limit or over budget → 429 / 503 without calling the model.
 *  3. Run the body. Every model call it makes is charged to the slot, and
 *     the total is written to the ledger even when the body fails, so the
 *     budget never undercounts.
 */
export async function guarded(
  request: Request,
  deps: AiDeps,
  route: AiRoute,
  body: (call: GuardedCall) => Promise<Response>,
): Promise<Response> {
  const { model, limiter, config } = deps
  if (!model) {
    return apiError('ai_unavailable', 'The AI features are switched off on this deployment.')
  }

  const identity = await resolveIdentity(request, deps.verifyToken, config.ipHashSalt)
  const limits = identity.kind === 'user' ? config.limits.user : config.limits.anon
  const slot = await limiter.tryConsume(identity, route, limits, config.budgetUsd)
  if (slot.status === 'rate_limited') {
    return apiError(
      'rate_limited',
      identity.kind === 'user'
        ? 'You have hit the AI limit for now. Try again in a minute, or tomorrow if you have used your daily allowance.'
        : 'You have hit the AI limit for visitors. Sign in for a higher limit, or try again later.',
    )
  }
  if (slot.status === 'budget_exhausted') {
    return apiError('budget_exhausted', 'The AI demo budget has been used up.')
  }

  let spent = NO_USAGE
  try {
    return await body({ model, charge: (usage) => (spent = addUsage(spent, usage)) })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return apiError('upstream_error', 'The AI service is busy. Try again in a moment.')
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`)
      return apiError('upstream_error', 'The AI service returned an error. Try again in a moment.')
    }
    throw error
  } finally {
    if (spent.costUsd > 0 || spent.inputTokens > 0) {
      // One line per request in the server / Vercel function logs.
      console.info(
        `[ai] ${route} ${identity.kind} in=${spent.inputTokens} out=${spent.outputTokens} $${spent.costUsd.toFixed(5)}`,
      )
      await limiter.record(slot.usageId, spent)
    }
  }
}

export function modelFailure(reason: 'refusal' | 'truncated' | 'invalid'): Response {
  switch (reason) {
    case 'refusal':
      return apiError('model_refused', 'The AI declined this request. Try rephrasing it.')
    case 'truncated':
    case 'invalid':
      return apiError('upstream_error', 'The AI returned an unusable answer. Try again.')
  }
}
