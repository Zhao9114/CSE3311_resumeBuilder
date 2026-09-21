import type { ResumeBlock, SectionType } from '../types'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Blocks the assistant proposes adding; the user accepts or ignores them. */
  proposed?: Omit<ResumeBlock, 'id'>[]
}

export interface AssistantRequest {
  prompt: string
  /** Section types already on the resume, so a reply can avoid duplicates. */
  present: SectionType[]
}

export interface AssistantService {
  send(request: AssistantRequest): Promise<AssistantMessage>
}

/**
 * TODO(iteration-2): implement against an LLM call routed through a
 * serverless function, returning generated blocks in `proposed`.
 *
 * Iteration 1 ships scripted replies and makes no network request. The
 * contract above is what the real service must satisfy, so swapping it in
 * leaves the chat UI unchanged.
 */
export const assistantService: AssistantService = {
  send() {
    return Promise.reject(
      new Error('The resume assistant is not available in iteration 1'),
    )
  },
}
