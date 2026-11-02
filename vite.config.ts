import type { IncomingMessage } from 'node:http'
import { configDefaults, defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves api/*.ts during `npm run dev`, so the AI features work locally
 * without the Vercel CLI. Each request is turned into a Web `Request` and
 * handed to the same exported `POST` that Vercel calls in production.
 *
 * Server-only variables (ANTHROPIC_API_KEY, …) are read from .env.local into
 * process.env here. They never pass through Vite's `import.meta.env`, so they
 * can't end up in the browser bundle.
 */
function devApi(): Plugin {
  return {
    name: 'draftly-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as Record<
            string,
            ((request: Request) => Promise<Response>) | undefined
          >
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            res.end()
            return
          }
          const response = await handler(await toRequest(req))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(String(error instanceof Error ? error.stack : error))
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'upstream_error', message: 'Dev API handler crashed.' }))
        }
      })
    },
  }
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  // Vercel sets this in production; the identity hash keys anonymous limits on it.
  if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', req.socket.remoteAddress ?? '')

  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi()],
  test: {
    // The RLS check talks to a real Supabase project, so `npm test` skips it;
    // `npm run test:rls` runs it with `--mode integration`.
    exclude:
      mode === 'integration'
        ? configDefaults.exclude
        : [...configDefaults.exclude, '**/*.integration.test.ts'],
    // Test-user credentials live in .env.test.local (gitignored). They are
    // only ever loaded here, for tests — never into the app bundle.
    env: loadEnv('test', '.', ['RLS_TEST_', 'VITE_SUPABASE_']),
  },
}))
