import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

/**
 * Haiku is the cheapest current Claude model and plenty for keyword
 * extraction and short rewrites — at $0.10 / $0.50 per million tokens a
 * typical call costs about a tenth of a cent, so the $5 project budget
 * covers thousands of demo requests.
 */
export const MODEL = 'claude-haiku-5-5'

/** USD per million tokens for MODEL (prompts under 100k tokens). */
const PRICE_PER_MTOK = {
  input: 0.1,
  cacheWrite: 0.125,
  cacheRead: 0.01,
  output: 0.5,
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 }

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  }
}

/** Output tokens include thinking, which is billed as output. */
export function usageOf(usage: Anthropic.Usage): TokenUsage {
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const costUsd =
    (usage.input_tokens * PRICE_PER_MTOK.input +
      cacheWrite * PRICE_PER_MTOK.cacheWrite +
      cacheRead * PRICE_PER_MTOK.cacheRead +
      usage.output_tokens * PRICE_PER_MTOK.output) /
    1_000_000
  return {
    inputTokens: usage.input_tokens + cacheWrite + cacheRead,
    outputTokens: usage.output_tokens,
    costUsd,
  }
}

export interface GenerateRequest<T> {
  system: string
  messages: Anthropic.MessageParam[]
  schema: z.ZodType<T>
  maxTokens: number
  /** Haiku's default is medium; extraction and short rewrites do fine on low. */
  effort: 'low' | 'medium'
}

export type GenerateResult<T> =
  | { ok: true; data: T; usage: TokenUsage }
  | { ok: false; reason: 'refusal' | 'truncated' | 'invalid'; usage: TokenUsage }

/**
 * The one seam between the handlers and the Anthropic API. Handlers take a
 * `Model`, so tests pass a fake and never touch the network or the budget.
 */
export interface Model {
  generate<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>>
}

export function createAnthropicModel(apiKey: string): Model {
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 45_000 })

  return {
    async generate<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>> {
      // `create` rather than `parse`: `parse` throws on output that fails the
      // schema, and the usage — which the budget needs — goes with it.
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages,
        output_config: { effort: request.effort, format: zodOutputFormat(request.schema) },
      })
      const usage = usageOf(message.usage)

      if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal', usage }
      if (message.stop_reason === 'max_tokens') return { ok: false, reason: 'truncated', usage }

      const text = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text
      if (!text) return { ok: false, reason: 'invalid', usage }
      let raw: unknown
      try {
        raw = JSON.parse(text)
      } catch {
        return { ok: false, reason: 'invalid', usage }
      }
      const parsed = request.schema.safeParse(raw)
      return parsed.success
        ? { ok: true, data: parsed.data, usage }
        : { ok: false, reason: 'invalid', usage }
    },
  }
}
