import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Why an AI request didn't return an answer. `offline` covers a missing
 * endpoint (a static preview with no functions), a network failure, and a
 * deployment with the AI switched off — the cases where the UI falls back
 * to sample output so a demo never dead-ends.
 */
export type AiErrorCode =
  | 'rate_limited'
  | 'budget_exhausted'
  | 'refused'
  | 'bad_request'
  | 'failed'
  | 'offline'

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

const SERVER_CODES: Record<string, AiErrorCode> = {
  rate_limited: 'rate_limited',
  budget_exhausted: 'budget_exhausted',
  model_refused: 'refused',
  bad_request: 'bad_request',
  upstream_error: 'failed',
  ai_unavailable: 'offline',
}

/**
 * A signed-in user's token lets the server count requests against their
 * account (a higher limit) instead of their IP.
 */
async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {}
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

export async function postAi<T>(path: '/api/ats' | '/api/assistant', body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError('offline', 'Could not reach the AI service.')
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload: unknown = isJson ? await response.json().catch(() => null) : null

  if (response.ok && payload) return payload as T

  const { error, message } = (payload ?? {}) as { error?: string; message?: string }
  const code = (error && SERVER_CODES[error]) || (response.status === 404 ? 'offline' : 'failed')
  throw new AiError(code, message ?? 'The AI request failed.')
}
