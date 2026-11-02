import type { Intent } from '../ai/intent'
import { parseBlock } from '../store/normalize'
import type { Resume, ResumeBlock } from '../types'
import { postAi } from './aiClient'

/**
 * A block the assistant offers. Nothing touches the resume until the user
 * accepts it: `replaces` names the block it would overwrite, or is null when
 * accepting adds a new section.
 */
export interface Proposal {
  block: ResumeBlock
  replaces: string | null
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** How the intent parser routed the request that produced this reply. */
  intent?: Intent
  intentSource?: 'rules' | 'model'
  proposals?: Proposal[]
  /** Set on an error reply, so the drawer can style it differently. */
  error?: boolean
}

export interface AssistantRequest {
  message: string
  resume: Resume
  /** Earlier turns, oldest first. The server keeps only the last few. */
  history: Pick<AssistantMessage, 'role' | 'text'>[]
}

export interface AssistantReply {
  text: string
  intent: Intent
  intentSource: 'rules' | 'model'
  proposals: Proposal[]
}

export interface AssistantService {
  send(request: AssistantRequest): Promise<AssistantReply>
}

export const assistantService: AssistantService = {
  async send({ message, resume, history }) {
    const reply = await postAi<AssistantReply>('/api/assistant', {
      message,
      resume,
      history: history.slice(-4).map(({ role, text }) => ({ role, text })),
    })
    // The server already validated these; checking again here means a bad
    // response can only drop a proposal, never put a broken block on screen.
    const proposals = (reply.proposals ?? []).flatMap((p) => {
      const block = parseBlock(p.block)
      return block ? [{ block, replaces: typeof p.replaces === 'string' ? p.replaces : null }] : []
    })
    return { ...reply, proposals }
  },
}
