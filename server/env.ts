/**
 * Server-side configuration, read once per cold start.
 *
 * None of these are VITE_-prefixed, so Vite never bundles them into the
 * browser. On Vercel they are set in Project Settings → Environment
 * Variables; locally they come from .env.local through the dev plugin in
 * vite.config.ts.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  const value = raw === undefined || raw.trim() === '' ? NaN : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function text(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export interface ServerConfig {
  anthropicApiKey: string
  supabaseUrl: string
  supabaseServiceKey: string
  ipHashSalt: string
  /** Total model spend the app may ever run up, in USD. */
  budgetUsd: number
  limits: {
    user: { perDay: number; perMinute: number }
    anon: { perDay: number; perMinute: number }
  }
}

export function readConfig(): ServerConfig {
  return {
    anthropicApiKey: text('ANTHROPIC_API_KEY'),
    // The browser's URL var works too: Vercel exposes every project env var
    // to functions at runtime, prefixed or not.
    supabaseUrl: text('SUPABASE_URL') || text('VITE_SUPABASE_URL'),
    supabaseServiceKey: text('SUPABASE_SERVICE_ROLE_KEY'),
    ipHashSalt: text('IP_HASH_SALT') || 'draftly-dev-salt',
    // $4 of the $5 project budget, so a burst of in-flight calls can't tip
    // the Console's hard limit before this check notices.
    budgetUsd: num('AI_BUDGET_USD', 4),
    limits: {
      user: { perDay: num('AI_DAILY_LIMIT_USER', 40), perMinute: num('AI_MINUTE_LIMIT_USER', 6) },
      anon: { perDay: num('AI_DAILY_LIMIT_ANON', 15), perMinute: num('AI_MINUTE_LIMIT_ANON', 4) },
    },
  }
}
