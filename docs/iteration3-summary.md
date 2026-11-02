# Draftly — Iteration 3: What Was Built (source material for the report)

**For the writer:** These are the facts for the Draftly Iteration 3 report (CSE 3311). Use the same structure as the Iteration 1 and 2 reports:

1. Introduction
2. Project Plan (roadmap, related apps, risks)
3. Specification and Design
4. Code and Tests
5. Customers and Users

Everything below describes code that has been built on the `iteration-3` branch. Items marked **[TEAM TO FILL IN]** are things the code can't tell you, such as user feedback or real spend from the live demo. Don't make them up.

- Team: Jacob Butler, Aashika Sapkota, Huy Thai, Zheng (Yao) Wong
- Repository: github.com/Zhao9114/CSE3311_resumeBuilder (branch `iteration-3`)
- Stack: React 18 + TypeScript + Vite, dnd-kit, Supabase (Postgres + Auth), Vercel (static site + serverless functions), Claude Haiku via the Anthropic SDK, Zod, Vitest, lucide-react icons

---

## 1. Iteration 3 goals

The IT2 roadmap listed iteration 3 as **"AI touch-up and ATS check, grounded in the pasted job posting"**. Two pieces of user feedback were added on top of that:

| Goal | Where it came from |
| --- | --- |
| Real AI behind the ATS check and the Assistant | Roadmap (IT1 and IT2) |
| The first piece of the RAG pipeline: an intent parser | Roadmap (RAG over postings is IT4; routing comes first) |
| A rate limiter, so the whole project stays under **$5** of AI spend | Team constraint |
| A modern UI with easier-to-read text | User feedback: "too simple, words were hard to read" |
| More interactive drag and drop | User feedback: wanted it to feel "more drag-and-droppy" |

Deliberately **not** done (scope guardrails):

- No retrieval over many postings and no embeddings. That is IT4.
- No job recommendations.
- No change to the data model of resumes, versions or applications.

---

## 2. Sprints

The work was split into seven sprints, run in this order so that each one had something working to show.

| Sprint | Theme | What it delivered |
| --- | --- | --- |
| 1 | AI foundation | Serverless functions in `api/`, the model wrapper with cost per call, the rate limiter and spend cap, the `ai_usage` ledger (migration 0002), the local dev server for the functions |
| 2 | Real ATS check | Keyword extraction by the model, matching and scoring in code, a verdict and tips tied to resume sections |
| 3 | Assistant + intent parser | Rules-first intent routing with a model fallback, per-intent prompts and output schemas, proposal cards with Insert or Replace |
| 4 | UI refresh | Design tokens, light and dark themes, larger and higher-contrast text, icons, a section colour per type, toasts |
| 5 | Drag & drop I: feel | Drag from anywhere on the card, a lifted card, a dashed slot left behind, a live paper preview while dragging, Hide and Remove drop zones, Undo (toast and Ctrl/Cmd+Z) |
| 6 | Drag & drop II: drag in | Drag a "+ Section" chip, a saved block, or an Assistant suggestion into the list at an exact position |
| 7 | Drag & drop III: inside and on the page | Reorder roles, bullets, skill groups and entries inside a section; reorder sections directly on the resume paper |

---

## 3. Project plan updates

### 3.1 Roadmap status

| Iteration | Planned | Status |
| --- | --- | --- |
| 1 | Block editor, drag and drop, show/hide, live preview, job tracker, PDF export | Done (IT1) |
| 2 | Supabase login and saving, resume version snapshots | Done (IT2) |
| 3 | AI touch-up and ATS check grounded in the pasted posting; intent parser; UI and drag-and-drop feedback | **Done (this iteration)** |
| 4 | RAG over past postings, job recommendations, richer analytics | Next. The intent parser is the hook: an intent like "tailor to job" will decide when to retrieve. |

### 3.2 Risks: what iteration 3 did about the ones tagged "Iteration 3"

**AI hallucination** (p = 0.7, E = 15, RE = 10.5). Planned: ground the AI in the pasted posting; the AI only edits what the user wrote; the user confirms every change.

- **The ATS score is not the model's opinion.** The model only *lists* what the posting asks for, with spelling aliases. Whether each keyword is on the resume, and the score, are computed in plain code (`server/ai/atsScore.ts`). The same resume and posting always get the same score, and the model can't claim a match that isn't there.
- **Every prompt forbids invention.** It forbids new employers, titles, dates, degrees, skills or numbers. Missing facts must become `[placeholders]` for the user to fill in.
- **Rewrites keep facts.** For "rewrite bullets", only the bullet text comes from the model. Role, employer and dates are copied from the resume in code.
- **The user confirms every change.** Everything the Assistant writes arrives as a proposal card. Nothing reaches the resume until the user presses Insert or Replace, or drags the card in, and every drop can be undone.
- **Output is validated.** Every model response is checked against a Zod schema, and every generated section goes through the same `parseBlock` check as a database row.

**AI API failure, throttling, or billing overrun** (p = 0.5, E = 12, RE = 6.0). Planned: hard spending cap with alerts, response caching, retry and backoff, canned fallback.

- **Model choice.** Claude Haiku (`claude-haiku-5-5`) at $0.10 / $0.50 per million input/output tokens. Measured live: $0.0002 per Assistant call, $0.0005 per ATS check. Effort is set to "low", which these tasks don't need more than.
- **Spend cap in the app.** `AI_BUDGET_USD` defaults to $4. Each call's real token cost is written to `ai_usage`, and once the total reaches the cap, every AI request is refused before the model is called.
- **Hard backstop.** A $5 monthly spend limit set in the Anthropic Console. **[TEAM TO CONFIRM it was set]**
- **Rate limits.** 40 calls per 24 h and 6 per minute for a signed-in user. 15 per 24 h and 4 per minute per anonymous visitor, keyed on a salted hash of the IP (the raw address is never stored). The checks run inside one SQL function under an advisory lock, so parallel requests can't slip past.
- **Input and output caps.** Posting ≤ 12,000 characters, message ≤ 2,000, only the last 4 chat turns sent, `max_tokens` 2,000 (400 for intent classification).
- **Caching.** An identical ATS re-check is answered from the browser's session storage at no cost.
- **Retry.** The SDK retries 429/5xx twice with backoff, with a 45-second timeout.
- **Canned fallback.** If the AI is offline (no key, network failure) or the budget is spent, the ATS check shows clearly labelled sample output and the Assistant says it is offline. The demo never dead-ends.
- **Cost report.** Every request's tokens and cost are stored. A ready-made SQL query in the migration shows spend by route and in total.

**Insecure AI prompting / prompt injection** (p = 0.3, E = 8, RE = 2.4). Planned: treat posting text as untrusted, clean input, keep each prompt scoped to one user.

- **Untrusted text is fenced.** Text in `<job_posting>`, `<resume>`, `<user_request>` or `<conversation>` tags is named in the system prompt as data, not instructions. Any closing tag inside the user's text is removed, so a posting can't end its block early.
- **Injection openers are refused without a model call.** The intent parser catches "ignore previous instructions", "system prompt", "you are now…", "jailbreak" and similar, along with off-topic requests, and returns a fixed reply without calling the model.
- **One user per prompt.** Requests are stateless, and each one contains only the caller's own resume.
- **The key never reaches the browser.** The Anthropic key and the Supabase service-role key are server-only environment variables. The production bundle was checked: neither name, the Anthropic SDK, nor the model id appears in it.
- **The ledger can't be forged.** `ai_usage` has RLS on with no policies and no grants, and its two functions can only be executed by the service role. Browsers can't read it, write themselves a bigger allowance, or call the limiter.

**User-access risk** (ongoing): **[TEAM TO FILL IN]** the feedback round for this iteration.

---

## 4. Specification and design changes

### 4.1 New inputs and outputs

New inputs:

- A pasted job description (ATS check).
- Free-text messages to the Assistant.
- Drag gestures: palette chips, library items and Assistant proposals into the list; cards onto Hide or Remove; roles and bullets inside a section; sections on the paper.
- Theme choice (light or dark).
- Ctrl/Cmd+Z for undo.

New outputs:

- An ATS verdict and score ring, keywords found, required and nice-to-have keywords missing, and tips tagged with the section they apply to.
- Assistant replies with an **intent chip** (for example "Rewrite bullets", or "· AI-routed" when the model did the classifying) and **proposal cards**.
- A live paper preview while dragging, a landing slot, drop zones, and Undo toasts.
- Friendly messages for rate limits, an exhausted budget, and the AI being offline.

### 4.2 Architecture

```
Browser ── POST /api/ats, /api/assistant ──► Vercel function (api/*.ts)
                                                │  validate (Zod) ─► intent parser (rules first)
                                                │  rate limit + budget (ai_try_consume) ─► refuse: 429 / 503
                                                │  Claude Haiku (structured JSON output)
                                                │  validate output, score in code
                                                └─ record tokens + cost (ai_record_usage)
```

- **The browser never talks to Anthropic.** `src/services/aiClient.ts` posts to the app's own `/api/*`, attaching the Supabase session token when signed in, which earns a higher limit.
- **One model seam.** Handlers receive a `Model` interface (`server/ai/model.ts`), so the tests pass a fake and never use the network or the budget.
- **Code shared by browser and server** sits in `src/ai/`: the intent parser, the input limits, and the resume-to-text renderer the prompts and the matcher both use.
- **Local development.** A small Vite plugin serves `api/*.ts` during `npm run dev`, so no Vercel CLI is needed.

### 4.3 The intent parser (first piece of RAG)

| Step | What happens | Cost |
| --- | --- | --- |
| 1 | Keyword rules score the message against seven intents: `write_summary`, `draft_experience`, `rewrite_bullets`, `add_skills`, `tailor_to_job`, `general_advice`, `off_topic` | Free |
| 2 | If one intent clearly wins (confidence ≥ 0.7), it is used | Free |
| 3 | Off-topic and injection openers get a fixed reply | Free, and doesn't use the caller's allowance |
| 4 | Otherwise a small Haiku call classifies the message (≤ 400 output tokens) | ≈ $0.0001 |
| 5 | The intent selects the prompt, the output schema, and the section the reply may touch | — |

In IT4 the same routing decides when to retrieve similar past postings.

### 4.4 Database (migration `0002_iteration3_ai.sql`)

| Object | Purpose |
| --- | --- |
| `ai_usage` table | One row per AI request: identity (`user:<uuid>` or `ip:<hash>`), route, input/output tokens, cost in USD. RLS on, no policies, no grants. |
| `ai_try_consume(...)` | Under an advisory lock, checks total spend against the budget and the caller's last-minute and last-24-hour counts, then reserves a row. Returns `ok`, `rate_limited` or `budget_exhausted`. |
| `ai_record_usage(...)` | Adds a finished call's real tokens and cost to the reserved row. Adds rather than sets, because one Assistant request can make two model calls. |

### 4.5 UI refresh

- **Tokens.** All colours come from `src/styles/tokens.css`, with a light and a dark set. Text/background pairs were chosen to meet WCAG AA (4.5:1).
- **Readability.** Body text went from 13–14 px to 15 px, captions from 12 px to 12.5–13.5 px, and muted text is darker.
- **Dark mode.** It follows the OS setting until the user picks one; the choice is saved, and an inline script applies it before first paint. **The resume paper stays light in both themes**, because it is the printed document. Print output was checked in dark mode and is unchanged.
- **Components.** Segmented view tabs; icons (lucide-react); one colour and icon per section type; switch, button and modal polish; status badges in the tracker; a toast with an action.

### 4.6 Drag-and-drop design

- **One shared drag context** (`src/features/dnd/BuilderDnd.tsx`) spans the editor, the palette, the block library, the Assistant drawer and the paper. Each draggable carries typed data saying what it is (`block`, `paper`, `new-section`, `saved-block`, `proposal`), and the provider decides what a drop means.
- **Nothing is written until the drop.** While dragging, the paper renders a preview of the result. Esc cancels.
- **Collision rules.** A drop zone only counts when the pointer is inside it. Something dragged in from outside only counts when the pointer is inside the section list. Paper sections stay within their column on the Sidebar template.
- **Inserting at a position** needed one store change: `addBlock` / `insertBlock` take an optional `atIndex` (both stores, and the shared pure functions in `resumeOps.ts`).
- **Reorder inside a section** uses a separate, nested drag context (`SortableList.tsx`), so dragging a bullet never picks up the section card.
- **Undo.** The provider keeps up to 20 snapshots. Undo is offered in the toast after every drop and removal, and on Ctrl/Cmd+Z outside text fields (inside a field, Ctrl+Z stays the field's own undo).
- **Accessibility.** Every grip supports the keyboard (Space, arrows, Space), and screen readers hear section names, positions, and what a zone will do. Chips and library items keep their click buttons as the keyboard path. All animation respects reduced-motion settings.

### 4.7 Bugs fixed along the way

- **The caret jumped to the end of a field after one keystroke when editing mid-text.** This existed in IT1 and IT2; the same test against the IT2 commit reproduced it. The cause: fields read their value from the store's async reply, so React reset each field first. Fixed by applying the same pure edit to the on-screen copy immediately, and discarding a store reply that a newer edit has already overtaken.
- **The contact line overflowed the paper when it was narrow** (for example with the Assistant drawer open). It now wraps between parts.
- **Modal dialogs pulled focus back to the first field** whenever the page behind them re-rendered. Fixed.

---

## 5. Code and tests

### 5.1 Main new files

| File | Purpose |
| --- | --- |
| `api/ats.ts`, `api/assistant.ts` | Vercel function entry points |
| `server/handlers/guard.ts` | AI on/off check, identity, rate limit + budget, ledger recording |
| `server/handlers/ats.ts`, `server/handlers/assistant.ts` | Prompts, schemas and routing for each endpoint |
| `server/ai/model.ts` | Haiku client, structured output, cost per call |
| `server/ai/atsScore.ts` | Deterministic keyword matching and scoring |
| `server/limits/*` | Rate limiter (Supabase-backed and in-memory) and identity |
| `src/ai/intent.ts` | Intent parser (shared) |
| `src/services/aiClient.ts`, `ats.ts`, `assistant.ts` | Browser side of the AI calls |
| `src/features/dnd/*` | Shared drag context, drop zones, drag card |
| `src/features/editor/SortableList.tsx`, `PaletteChip.tsx` | Nested reorder, draggable palette chips |
| `src/styles/tokens.css`, `src/styles/dnd.css` | Design tokens (light/dark), drag-and-drop styles |
| `supabase/migrations/0002_iteration3_ai.sql` | AI usage ledger and limiter functions |

### 5.2 Tests

**Unit tests (`npm test`): 104 passed in 10 files** (43 from IT2 + 61 new). No network access, no spend.

| Test file | Tests | What it covers |
| --- | --- | --- |
| `src/ai/intent.test.ts` | 18 | Each intent routed by rules; pasted postings; off-topic and prompt-injection refusals; ambiguous messages left to the model; skill extraction |
| `server/ai/atsScore.test.ts` | 16 | Matching: case, punctuation, Node.js/NodeJS, CI/CD/CICD, aliases (Postgres, k8s), plurals, whole words only, phrases in order; 75/25 weighting; verdict thresholds; repeatability |
| `server/handlers/handlers.test.ts` | 14 | Both endpoints with a fake model: scoring in code; posting fenced as data; input validation; AI switched off; budget exhausted and off-topic **without calling the model**; per-IP rate limit; cost recorded even when the output is unusable; refusals; bullets-only rewrites keep role, employer and dates; skill groups merged without duplicates |
| `server/limits/rateLimiter.test.ts` | 4 | Per-minute and rolling 24-hour limits, separate identities, global spend cap |
| `src/store/resumeOps.test.ts` | 9 | Insert at a position, out-of-range falls back to append, one-per-type rule still holds, `moveItem` |
| IT2 files (unchanged) | 43 | As in the IT2 report |

**Row-level security (`npm run test:rls`).** Two new checks were added: no browser session (signed out or signed in) can read or write `ai_usage`, or call `ai_try_consume` / `ai_record_usage`. **[TEAM TO RUN after applying migration 0002, and report the result]**

**Browser checks (headless Chrome, real mouse and keyboard events, demo mode).** 26 of 26 passed:

- Reordering by dragging the card body; the paper shows the new order mid-drag; the toast offers Undo; Ctrl+Z restores.
- Drop on Remove removes, and Undo in the toast brings it back; the zone highlights under the pointer.
- A "+ Custom section" chip dropped between the first two cards lands at position 2.
- Reordering on the paper updates the editor list too.
- The Edit button still clicks (no accidental drags); keyboard reorder works.
- Bullets and roles reorder inside Experience; typing mid-word keeps the caret in place.
- A saved block dragged in lands before the card it was dropped on.
- With the AI endpoints mocked: the Assistant sends the message, resume and history; the intent chip shows; a proposal dragged from the drawer lands at the drop position and is marked Applied; the ATS panel sends the posting and renders the verdict, ring colour and tips.

**Live calls against the real model** (local dev server, Claude Haiku `claude-haiku-5-5`, 2 November 2026):

| Call | HTTP | Time | Tokens in / out | Cost |
| --- | --- | --- | --- | --- |
| ATS check (frontend intern posting) | 200 | 4.2–7.8 s | ~1,600 / ~700 | $0.00050–0.00052 |
| Assistant: "Rewrite my bullets to lead with action verbs" (routed by rules) | 200 | 2.6 s | 970 / 172 | $0.00018 |
| Assistant: "hi, can you help me?" (routed by the model → general advice) | 200 | 3.5 s | 1,330 / 83 | $0.00017 |

What the live output showed:

- **The bullet rewrite kept every fact.** It led with action verbs, and where an outcome was missing it inserted placeholders ("[metric on feature adoption or impact]") rather than inventing numbers.
- **The first ATS run exposed a scoring flaw.** The posting said "Jest or Vitest", and the model listed them as two separate required keywords, so a candidate with only one would be marked down twice. The prompt now asks for alternatives as one keyword with aliases. Re-run: "Jest or Vitest" became a single requirement, and the score went from 50 to 60.
- **Per-call cost is about half the estimate** used when planning ($0.0002–0.0005 rather than $0.001), so the $4 cap covers roughly 8,000–20,000 calls.

Each request now also writes one line to the server log (and Vercel function logs), for example `[ai] ats anon in=1652 out=700 $0.00052`.

**Still to verify** **[TEAM TO DO and report]**:

- The same calls on the Vercel deployment, after adding the environment variables there.
- The rows in `ai_usage`, once migration 0002 and `SUPABASE_SERVICE_ROLE_KEY` are in place. Locally, without the service-role key, the limiter ran in memory.
- That the rate-limit and budget messages appear in production (set `AI_DAILY_LIMIT_ANON=1` or `AI_BUDGET_USD=0.0001` temporarily).

### 5.3 How to run

```
npm install
npm run dev        # app + /api functions at http://localhost:5173
npm run build      # type-check (app, server, config) + production build
npm test           # 104 unit tests, no network
npm run test:rls   # RLS checks against the real Supabase project
```

AI setup (README → "AI setup"):

1. Run migration 0002.
2. Set a $5 spend limit in the Anthropic Console.
3. Put `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `IP_HASH_SALT` in `.env.local` and in Vercel.
4. Revoke the key after the demos.

---

## 6. Customers and users

**[TEAM TO FILL IN]** The rubric rewards real user interaction. Include how many people, how they were asked, quotes with names and dates, and what changed because of them.

The two pieces of feedback this iteration acted on:

- **"The UI is too simple, and the words are hard to read."** Acted on in sprint 4: tokens, dark mode, larger and higher-contrast text, icons, and per-section colour.
- **"Make the drag and drop more interactive."** Acted on in sprints 5–7, as listed in section 2.

Worth asking users about in the next round:

- Does the ATS score feel fair, and are the tips useful?
- Do proposal cards (rather than direct edits) feel safe or slow?
- Is the live paper preview while dragging helpful?
- Do people find the Hide and Remove zones, and Undo?
- Light or dark mode?

---

## 7. Notes and limitations (for honesty in the report)

- **Live AI checked locally, not yet on Vercel.** The real model was called from the local dev server (see 5.2); the deployed functions still need a smoke test.
- **Budget overshoot is bounded, not zero.** The budget check is serialised per user, not globally, so a few requests already in flight when the cap is reached can still complete (about $0.001 each). The gap between the $4 app cap and the $5 Console limit absorbs this.
- **Without the service-role key**, limits are kept in memory per function instance. That's fine locally, but production needs `SUPABASE_SERVICE_ROLE_KEY`.
- **Replacement proposals aren't draggable.** A proposal that replaces an existing section (for example a new summary) is applied with its button, because it belongs where that section already is. Proposals that add a new section can be dragged.
- **Keyboard drag-in.** Chips and library items are added with a click or Enter from the keyboard; only mouse and touch drag them. All reordering works from the keyboard.
- **Prompt caching** was not relied on: the system prompts are shorter than Haiku's minimum cacheable length, so the saving would be zero.
