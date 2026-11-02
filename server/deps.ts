import { createClient } from '@supabase/supabase-js'
import { readConfig, type ServerConfig } from './env.js'
import { createAnthropicModel, type Model } from './ai/model.js'
import type { VerifyToken } from './limits/identity.js'
import { MemoryRateLimiter, type RateLimiter } from './limits/rateLimiter.js'
import { SupabaseRateLimiter } from './limits/supabaseRateLimiter.js'

/** Everything a handler needs from the outside world; tests pass fakes. */
export interface AiDeps {
  config: ServerConfig
  /** Null when ANTHROPIC_API_KEY is unset: the AI is switched off. */
  model: Model | null
  limiter: RateLimiter
  verifyToken: VerifyToken | null
}

let cached: AiDeps | null = null

/** Built once per function instance and reused across requests. */
export function defaultDeps(): AiDeps {
  if (cached) return cached
  const config = readConfig()
  const model = config.anthropicApiKey ? createAnthropicModel(config.anthropicApiKey) : null

  let limiter: RateLimiter
  let verifyToken: VerifyToken | null = null
  if (config.supabaseUrl && config.supabaseServiceKey) {
    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    limiter = new SupabaseRateLimiter(admin)
    verifyToken = async (token) => {
      const { data, error } = await admin.auth.getUser(token)
      return error ? null : (data.user?.id ?? null)
    }
  } else {
    if (process.env.VERCEL) {
      console.warn(
        'SUPABASE_SERVICE_ROLE_KEY is not set: AI limits are per-instance only. Set it in production.',
      )
    }
    limiter = new MemoryRateLimiter()
  }

  cached = { config, model, limiter, verifyToken }
  return cached
}
