import { defaultDeps } from '../server/deps.js'
import { handleTailor } from '../server/handlers/tailor.js'

/** POST /api/tailor — build a resume for a posting from the user's block bank. */
export function POST(request: Request): Promise<Response> {
  return handleTailor(request, defaultDeps())
}
