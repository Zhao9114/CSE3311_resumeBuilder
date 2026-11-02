import type { z } from 'zod'

/** Error codes the browser maps to messages (see src/services/aiClient.ts). */
export type ApiErrorCode =
  | 'bad_request'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'ai_unavailable'
  | 'model_refused'
  | 'upstream_error'

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  rate_limited: 429,
  budget_exhausted: 503,
  ai_unavailable: 503,
  model_refused: 422,
  upstream_error: 502,
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function apiError(code: ApiErrorCode, message: string): Response {
  return json({ error: code, message }, STATUS[code])
}

/**
 * A resume plus a 12k-character posting is well under this; anything bigger
 * is refused before it is parsed, let alone sent to a model.
 */
const MAX_BODY_BYTES = 96 * 1024

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response }

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<BodyResult<T>> {
  if (request.method !== 'POST') {
    return { ok: false, response: json({ error: 'bad_request', message: 'Use POST.' }, 405) }
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, response: apiError('bad_request', 'Request is too large.') }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, response: apiError('bad_request', 'Body must be JSON.') }
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    const first = result.error.issues[0]
    const where = first?.path.length ? `${first.path.join('.')}: ` : ''
    return { ok: false, response: apiError('bad_request', `${where}${first?.message ?? 'Invalid request.'}`) }
  }
  return { ok: true, data: result.data }
}
