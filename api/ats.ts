import { defaultDeps } from '../server/deps.js'
import { handleAts } from '../server/handlers/ats.js'

/** POST /api/ats — score the resume against a pasted job posting. */
export function POST(request: Request): Promise<Response> {
  return handleAts(request, defaultDeps())
}
