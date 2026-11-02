import { createHash } from 'node:crypto'
import type { Identity } from './rateLimiter.js'

/** Returns the user id for a valid Supabase access token, or null. */
export type VerifyToken = (token: string) => Promise<string | null>

/**
 * Who a request counts against. A valid sign-in gets that user's own (more
 * generous) limits. Everyone else — demo mode, or a token that doesn't check
 * out — is counted by IP. Only a salted hash of the IP is kept, never the
 * address itself.
 */
export async function resolveIdentity(
  request: Request,
  verifyToken: VerifyToken | null,
  salt: string,
): Promise<Identity> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (token && verifyToken) {
    const userId = await verifyToken(token).catch(() => null)
    if (userId) return { key: `user:${userId}`, kind: 'user' }
  }
  return { key: `ip:${hashIp(clientIp(request), salt)}`, kind: 'anon' }
}

/**
 * Vercel sets x-forwarded-for itself, with the real client first; the dev
 * plugin sets it from the socket address.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}
