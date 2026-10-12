import { configDefaults, defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
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
