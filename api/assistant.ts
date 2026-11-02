import { defaultDeps } from '../server/deps.js'
import { handleAssistant } from '../server/handlers/assistant.js'

/** POST /api/assistant — one chat turn with the resume assistant. */
export function POST(request: Request): Promise<Response> {
  return handleAssistant(request, defaultDeps())
}
