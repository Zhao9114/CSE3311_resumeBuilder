# Draftly

A block-based resume builder with drag-and-drop sections, a live preview, and
a job application tracker.

Iteration 1 built the full UI and the drag-and-drop editor. Iteration 2 makes
the work permanent and private: Supabase login, saving to Supabase behind the
existing store interfaces, row-level security, and immutable **resume
versions** that the job tracker links to. That way "Resume used" shows exactly
what was sent.

Iteration 3 adds the AI and reworks the interface:

- **AI.** A real **ATS check** and a **resume assistant**, both on Claude Haiku
  through serverless functions. An **intent parser** routes every assistant
  message, and a **rate limiter and spend cap** keep the whole project under a
  $5 budget. See [AI features](#ai-features).
- **UI.** A modern refresh with **light and dark** themes and larger,
  higher-contrast text.
- **Drag and drop.** You can now drag from the whole card. The paper previews
  the result live while you drag. You can drag sections in from the palette,
  the block library or the assistant, reorder roles and bullets inside a
  section, reorder sections directly on the paper, and drop a card on Hide or
  Remove zones. Every change can be undone with Ctrl/Cmd+Z. See
  [Drag and drop](#drag-and-drop).

Iteration 4 (final) turns the block library into a **block bank** and adds
**retrieval-augmented tailoring**:

- **Block bank.** Save each role, project, education entry and skill group on
  its own ("Save to bank", or "Add all entries from this resume"). Inserting
  an entry joins the existing section instead of creating a second one. See
  [Block bank](#block-bank).
- **Tailoring (RAG).** After an ATS check, "Build tailored resume" ranks every
  entry on the resume and in the bank against the posting's keywords *in
  code*, assembles a resume from the best ones, and has Haiku rewrite only the
  summary from those entries. See [Tailoring](#tailoring-rag).
- **Assistant fixes.** It can now add education and projects, never claims to
  have changed the resume in advice mode, answers "how do I..." with steps in
  Draftly's own UI, and says plainly that it can't open links.
- **Paper fixes.** Links in the header and an optional project link are real
  links in the PDF; Compact is genuinely dense with its own print margins; on
  phones an Edit / Preview switch replaces the long stacked page.

## Running it

Prerequisites: Node.js 18+ and npm.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check (no TS errors) + production build into dist/
npm run preview   # serve the built output
npm test          # unit tests (no network)
npm run test:rls  # row-level security checks against your Supabase project
```

The app runs in one of two modes, chosen at startup:

| Mode | When | What you get |
| --- | --- | --- |
| **Demo** | No `.env.local` | In-memory demo data, no login. Nothing persists. Same as iteration 1. |
| **Supabase** | `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Sign-in screen; everything saves to your account. |

See [Supabase setup](#supabase-setup) to switch on Supabase mode.

Deploying to Vercel: it is a standard Vite app at the repo root, with
`npm run build` producing `dist/`. Vercel also deploys `api/*.ts` as serverless
functions. Add the two `VITE_SUPABASE_*` variables plus the server-only AI
variables (see [AI setup](#ai-setup)) in the Vercel project settings.

`npm run dev` serves those same functions locally through a small Vite plugin
in `vite.config.ts`, so you don't need the Vercel CLI.

## How it is put together

```
src/
  types/        data contracts (Resume, ResumeBlock, Application, ResumeVersion)
  store/
    types.ts            store interfaces: the only way components touch data
    resumeOps.ts        pure resume edits (reorder, toggle, add…) shared by both stores
    memoryStore.ts      in-memory stores (demo mode, tests)
    supabaseStore.ts    Supabase stores (signed-in mode)
    supabaseMappers.ts  row <-> domain conversion
    normalize.ts        clean data on write, parse defensively on read
    StoreProvider.tsx   React context + hooks (useResume, useVersions, …)
  lib/supabase.ts  Supabase client; refuses secret keys
  data/seed.ts  demo data and the blank starter resume for new users
  features/
    auth/       AuthProvider (session), AuthGate, AuthScreen (sign in / up)
    editor/     block list, per-section forms, drag-and-drop, resume paper, versions
    tracker/    applications table, stats, add/edit modal
    ats/        ATS check panel
    assistant/  assistant drawer with proposal cards
    dnd/        BuilderDnd: the shared drag-and-drop context, drop zones, undo
  components/   TopBar, Modal, Toast, ThemeToggle, useTheme, useReducedMotion
  ai/           shared by browser and server: intent parser, input limits, resume → text
  services/     ats.ts, assistant.ts, aiClient.ts: the browser side of the AI calls
  styles/       tokens.css (light/dark design tokens), dnd.css, templates.css, …
api/            Vercel serverless entry points: POST /api/ats, POST /api/assistant
server/
  ai/           model wrapper (Claude Haiku, cost per call), ATS keyword scoring, prompt helpers
  limits/       rate limiter (Supabase-backed or in-memory), caller identity
  handlers/     request handling for each endpoint
supabase/migrations/  SQL for the tables, RLS policies, triggers, and the AI usage ledger
```

The ideas that carry most of the weight:

**`ResumeBlock` is a discriminated union.** Narrowing on `block.type` also
narrows `block.data`, so each branch of the editor and the preview gets its own
typed payload with no casts.

**Custom sections.** The five built-in types are capped at one each, but a
resume can carry any number of `custom` blocks with user-written titles.
`isRepeatable` in `src/types/resume.ts` is what distinguishes them, and
`addBlock` only dedupes the non-repeatable kinds.

**Components never touch state directly.** Every read and write goes through
`ResumeStore` / `ApplicationStore` / `BlockLibraryStore` / `ResumeVersionStore`,
exposed as hooks. `main.tsx` decides which implementation backs them: in-memory
in demo mode, Supabase when signed in. No component imports Supabase.

**One set of edit rules.** The reorder, show/hide and add logic lives once, as
pure functions in `src/store/resumeOps.ts`. Both stores call them, so the unit
tests cover what gets persisted too.

**Resumes save in the background.** Block and profile edits fire on every
keystroke. The Supabase resume store applies each one to a local cache right
away and writes the whole row after a ~600 ms pause in typing. Writes go
through a single queue so they arrive in order, and a failed write is retried.
The top bar shows *Saving… / All changes saved / Couldn't save — retrying*.
Pending edits are flushed before sign-out, and the browser warns before closing
a tab that still has unsaved edits.

**Normalize on save, not while typing.** `normalize.ts` trims text, drops
empty bullets and rewrites dates into one style (`05/2024 - current` →
`May 2024 – Present`) only when a row is written. Doing it while typing would
eat the space you just pressed. Every read is parsed defensively, so a
malformed row falls back to defaults instead of breaking the preview.

## Resume versions

**Save version** in the builder freezes a deep copy of the resume as it looks
right now. Versions are immutable. Editing the live resume never changes them,
and the database rejects updates to them (no UPDATE/DELETE policy, plus a
trigger). **Restore** copies a version's content back into the live resume and
leaves the version untouched.

Each tracked application points at a version (`Application.versionId`), not at
the live resume. The "Resume used" column therefore shows what was actually
sent, even after the resume keeps changing. When adding an application, the
default choice is **Snapshot current resume now**, which saves a version named
`Employer — Role` and links it in one step.

## Security

- **Managed login** through Supabase Auth (email + password). The app never
  stores passwords; supabase-js holds a JWT session and refreshes it.
- **Row-level security** on every table: each row has a `user_id` that
  defaults to `auth.uid()`, and policies only allow reading and writing rows
  where `user_id = auth.uid()`. The browser never sends `user_id`. Signed-out
  visitors have no table access at all. An application can only reference a
  version owned by the same user (composite foreign key).
- **No secrets in the client.** Only the project URL and the anon / publishable
  key are bundled. Both are public by design, and RLS is what protects the data.
  `src/lib/supabase.ts` refuses to start if given a `service_role` or
  `sb_secret_` key. `.env.local` and `.env.test.local` are gitignored (`*.local`).
- **Server-only AI secrets.** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
  are read only by the functions in `api/`. They have no `VITE_` prefix, so
  Vite can't bundle them. The production build contains neither name, nor the
  Anthropic SDK.
- **Encryption at rest** is on by default for every Supabase project (AES-256
  on the underlying storage), and all traffic is over HTTPS.

## Templates

Five templates change how the resume renders. The content and block order are
never touched by a switch — only the presentation.

| Template | Look |
| --- | --- |
| Classic | Centered serif header, ruled section titles |
| Modern | Left-aligned sans, accent titles with a left rule |
| Compact | Tight spacing to fit more on one page |
| Elegant | Serif small caps, hairline rules, wide margins |
| Sidebar | Two columns, with contact, skills and education on the left |

Sidebar is the only structural one: it splits the same blocks across two
columns rather than restyling a single column. Because `min-height` does not
apply on paper, its print rules stretch the columns to the page box so the
sidebar tint runs the full height of the sheet.

Templates live in `src/styles/templates.css`, one block of rules per
`.tpl-*` class. Adding a sixth means adding an entry to `TEMPLATES` in
`src/types/template.ts` and a matching block of CSS.

## Accessibility

- Sections reorder by mouse drag **and** by keyboard: focus a drag handle, press
  space, use the arrow keys, press space again. Moves are announced to screen
  readers by section name and position.
- `prefers-reduced-motion` is respected. dnd-kit applies its transitions as
  inline styles that CSS cannot override, so `useReducedMotion` drops the
  sortable transition and the drop animation at the source.
- The add/edit dialog traps focus, restores focus to its trigger on close, and
  closes on Escape.
- The save-status pill is a polite live region, so screen readers hear when
  work is saved or a save fails.

## Export PDF

The Export PDF button switches to the builder and calls `window.print()`. A
print stylesheet hides the app chrome so only the resume paper prints, with
page margins and `break-inside: avoid` on sections and items.

## Block bank

The bank holds **entries**: one role, one project, one education entry, one
skill group, or a summary. Save one with **Save to bank** on that entry in the
editor, or press **Add all entries from this resume**; duplicates (same text,
ignoring case and spacing) are skipped. A whole section can still be saved
from its card. Entries belong to the user, not to a resume or version, so they
are available to every resume they build.

- An entry is stored as an ordinary block holding a single item
  (`src/store/entries.ts`), so it uses the existing `saved_blocks` table,
  mappers and validation with **no migration**.
- **Insert** (or drag in) adds a copy. For a built-in section the resume
  already has, the entry **joins that section** (skipping items it already
  holds) and the section is shown. This also fixed iteration 3's bug where
  inserting a saved Skills block created a second Skills section.
- Entries can be renamed, filtered by tag, and are grouped by section.
- Demo mode starts with a seeded bank (the demo resume's entries plus extra
  roles and projects that are not on it) and keeps it in this browser's
  localStorage. Signed in, it lives in `saved_blocks` behind row-level security.

## Tailoring (RAG)

"Build tailored resume" in the ATS panel (`POST /api/tailor`,
`server/handlers/tailor.ts`) is retrieval-augmented generation in three steps:

1. **Retrieve, in code** (`server/ai/retrieve.ts`). Every entry on the resume
   and in the bank is scored against the keywords the ATS check extracted:
   3 points per required keyword it covers, 1 per nice-to-have, using the same
   matcher as the ATS score. The draft takes the 3 most relevant roles, up to 2
   projects that cover a keyword, the resume's skill groups plus matching bank
   groups, and the resume's education. Matching bullets and skills move to the
   top. This costs nothing, gives the same picks for the same inputs, and every
   pick shows which keywords earned it.
2. **Augment and generate.** One Haiku call (`max_tokens` 400) sees **only the
   chosen entries** and the matched keywords, and returns only a summary.
3. **Check in code.** A summary that names a posting keyword the draft does not
   contain is discarded (`inventedKeywords`). The draft is re-scored, so the
   panel shows the change, e.g. "25 → 83".

The user sees each pick (from the resume or the bank, with its matched
keywords), what was left out, and the score change, then chooses **Apply**
(the current resume is saved as a "Before tailoring" version first, and the
change can be undone) or **Save as version only**. If the AI is off, over the
limit or out of budget, the retrieved draft still comes back with the original
summary and a note saying why. Measured live: about 2.6 s and $0.0002 per tailoring call.

## AI features

Both features call **Claude Haiku** (`claude-haiku-5-5`, $0.10 / $0.50 per
million input/output tokens) from serverless functions. The Anthropic key
lives only on the server and never reaches the browser.

**ATS check** (`POST /api/ats`). The model reads the pasted posting and lists
the required and nice-to-have keywords, with aliases (PostgreSQL ↔ Postgres),
plus 3–5 tips. **Matching and scoring are done in code, not by the model**
(`server/ai/atsScore.ts`). Each keyword is looked up in the resume text, and
the score is 75% required matches and 25% preferred, so the same resume and
posting always get the same score. Identical re-checks are served from the
tab's session storage for free.

**Assistant** (`POST /api/assistant`). Every message first goes through the
**intent parser** (`src/ai/intent.ts`), the first piece of the RAG pipeline
planned for iteration 4:

1. Keyword rules classify the message: write a summary, draft an experience
   entry, rewrite bullets, add skills, add education, add a project, tailor to
   a job, give advice, or off topic. This costs nothing.
2. Only if the rules aren't confident does a small Haiku call classify it.
3. Off-topic messages and prompt-injection openers ("ignore previous
   instructions…") are refused **without any model call** and don't count
   against the limit. So is a request to read a link ("import from my
   homepage ..."): the assistant cannot open web pages, and says so.
4. The intent picks the prompt and the output schema. "Rewrite bullets" can
   only return new bullets for the existing roles, and the role, employer and
   dates are copied from the resume, not from the model.

In advice mode the model is told it cannot change the resume and is given a
short guide to Draftly's controls, so "make the layout more compact" comes
back as "pick Compact in the Template row", not an offer it can't keep.

Replies come back as **proposal cards**. Nothing changes on the resume until
the user presses Insert or Replace, or drags the card into the section list.
Every generated block passes the same `parseBlock` check as a database row.

**Cost and abuse controls** (`server/handlers/guard.ts`,
`supabase/migrations/0002_iteration3_ai.sql`):

| Guard | Default (env var) |
| --- | --- |
| Signed-in user | 40 calls / 24 h, 6 / min (`AI_DAILY_LIMIT_USER`, `AI_MINUTE_LIMIT_USER`) |
| Anonymous visitor, by salted IP hash | 15 / 24 h, 4 / min (`AI_DAILY_LIMIT_ANON`, `AI_MINUTE_LIMIT_ANON`) |
| Total spend, all users | $4.00 (`AI_BUDGET_USD`); after that, both features fall back to labelled sample output |
| Hard backstop | A $5 spend limit set in the Anthropic Console |
| Input size | Posting ≤ 12,000 chars, message ≤ 2,000 chars, last 4 chat turns |
| Output size | `max_tokens` 2,000 (ATS, assistant), 400 (intent, tailoring summary) |
| Block bank sent for tailoring | ≤ 100 entries, blocks only (no names or tags) |

Every call's tokens and dollar cost are written to the `ai_usage` table, which
browsers can't read or write. A query at the bottom of the migration shows
where the budget went. Measured: about $0.0002 per assistant reply and $0.0005 per ATS check.

Untrusted text (the posting, the user's message) is wrapped in tags the system
prompt names as data, and closing tags inside it are removed, so a posting
can't break out and give the model instructions.

## Drag and drop

One drag-and-drop context (`src/features/dnd/BuilderDnd.tsx`) spans the
editor, the palette, the block library, the assistant drawer and the paper:

- **Reorder** a section by dragging the whole card, not just the grip. The
  paper shows the new order live while you drag; Esc cancels.
- **Hide / Remove zones** appear at the bottom of the editor while a card is
  being dragged.
- **Drag in** a "+ Section" chip, a saved block, or an assistant suggestion.
  A gap opens where it will land. Clicking still appends.
- **Inside a section**, drag roles, bullets, skill groups and entries by their
  grips (`SortableList.tsx`).
- **On the paper**, hover a section and drag its grip. On the Sidebar template
  a section stays in its own column.
- **Undo**: each drop shows a toast with Undo, and Ctrl/Cmd+Z undoes the last
  drag, removal, or version restore (outside text fields, where it stays the
  field's own undo).
- **Keyboard**: every grip works with Space, the arrow keys and Space, with
  screen-reader announcements in section names. Chips and library items keep
  their click buttons as the keyboard path.

## Tests

`npm test` runs everything below except the RLS suite, with no network access.

| File | What it covers |
| --- | --- |
| `src/store/memoryStore.test.ts` | Block reorder (`reorderBlocks`), show/hide (`toggleBlock`), application stats (`isInProgress`), empty custom status falling back to "Custom" (`statusLabel`, `update`) |
| `src/store/versions.test.ts` | Save/load round trip (`ResumeStore.save`/`get`); snapshot immutability (`ResumeVersionStore.snapshot` after every kind of live edit, and after mutating returned objects); tracker resolution (`resumeUsedLabel`) to the right version as the resume changes; seed data still consistent |
| `src/store/supabaseMappers.test.ts` | Database round trip: `resumeToRow`/`resumeFromRow`, `versionToRow`/`versionFromRow`, `applicationToRow`/`applicationFromRow`, `savedBlockToRow`/`savedBlockFromRow`, preserving block order and visibility |
| `src/store/supabaseStore.test.ts` | `SupabaseResumeStore` on a fake client: exactly one starter resume for a new user, a burst of edits collapsing into one write of the newest state, reload matching what was saved, and a failed write being retried (`flush`, sync status) |
| `src/store/normalize.test.ts` | `normalizeDateText`, `normalizeIsoDate`, `normalizeResume`, `normalizeApplication`, and `parseResume`/`parseBlock` on malformed rows |
| `src/store/entries.test.ts` | Splitting sections into entries, entry names, duplicate detection (`entryFingerprint`), and an inserted entry joining the existing section instead of duplicating it |
| `server/ai/retrieve.test.ts` | Tailoring retrieval: ranking by keyword coverage with required weighted above preferred, resume/bank de-duplication, per-section caps, only known entries used, ids and order kept, bullet and skill reordering, determinism |
| `src/lib/links.test.ts` | Which contact parts become links (`mailto:`, bare domains, not "Node.js"), splitting the Links field |
| `src/store/resumeOps.test.ts` | Drag-and-drop inserts at a position (`addBlock`/`insertBlock` with `atIndex`), the one-per-type rule still holding, and `moveItem` for reordering inside a section |
| `src/ai/intent.test.ts` | The intent parser's rules: each intent (including education and projects), questions vs. requests, link requests, pasted postings, off-topic and prompt-injection refusals, ambiguous messages left to the model, skill extraction |
| `server/ai/atsScore.test.ts` | ATS keyword matching (case, punctuation, Node.js/NodeJS, aliases, plurals, whole words, phrases) and the score and verdict |
| `server/limits/rateLimiter.test.ts` | Per-minute and rolling 24-hour limits, separate identities, the global spend cap |
| `server/handlers/handlers.test.ts` | All three endpoints against a fake model. Tailoring: one summary call over only the chosen entries, the invented-keyword check, and its fallbacks. Assistant: education/project cards, the link reply, advice mode's no-edit rule. Plus: scoring in code, posting fenced as data, validation, AI off, budget exhausted and off-topic **with no model call**, IP rate limits, cost charged even on bad output, refusals, bullets-only rewrites, skill merging |
| `src/store/rls.integration.test.ts` | `npm run test:rls`: against the real database, with two test users. Another user can't read, update, delete or insert-as the owner's rows; can't see or link to their versions; versions can't be edited; signed-out visitors see nothing; no browser session can read or write the AI usage ledger or call its functions |

## Supabase setup

1. **Get the keys.** In the Supabase dashboard open **Project Settings → API**
   (or **API Keys**). Copy the **Project URL** and the **anon** key (shown as
   the *publishable* key, `sb_publishable_…`, on newer projects). Do **not**
   copy the `service_role` / secret key.
2. **Create `.env.local`** in the repo root by copying `.env.example`, and fill
   in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Create the tables.** Open **SQL Editor → New query**, paste all of
   `supabase/migrations/0001_iteration2.sql`, and click **Run**. It is safe to
   run again.
4. **Configure auth.** Under **Authentication → Sign In / Providers**, make
   sure **Email** is enabled. Under **Authentication → URL Configuration**, set
   **Site URL** to `http://localhost:5173` and add your deployed URL to
   **Redirect URLs**. For quicker local testing you can turn off **Confirm
   email**; with it on, new users must click the emailed link before signing
   in.
5. **Run it.** Restart `npm run dev`. You should see the sign-in screen.
   Create an account, edit the resume, and reload. Your edits are still there.
6. **Verify RLS.** In **Table Editor**, each of `resumes`, `resume_versions`,
   `applications` and `saved_blocks` should be labelled *RLS enabled*. Then
   create two test users (**Authentication → Users → Add user**, with *Auto
   Confirm* ticked) and put their credentials in `.env.test.local`:

   ```
   RLS_TEST_EMAIL_A=alice@example.com
   RLS_TEST_PASSWORD_A=...
   RLS_TEST_EMAIL_B=bob@example.com
   RLS_TEST_PASSWORD_B=...
   ```

   Run `npm run test:rls`. All checks should pass.
7. **Deploy.** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the
   Vercel project's environment variables and redeploy.

## AI setup

1. **Create the ledger.** In the Supabase SQL editor, run
   `supabase/migrations/0002_iteration3_ai.sql`, then
   `supabase/migrations/0003_iteration4_tailor.sql` (lets the ledger record
   the tailoring route). Both are safe to re-run.
2. **Get an Anthropic key** at console.anthropic.com. Under **Billing →
   Limits**, set a **monthly spend limit of $5**. That is the hard backstop
   behind the app's own $4 cap.
3. **Set the server variables** in `.env.local` (locally) and in the Vercel
   project settings (production). They have no `VITE_` prefix, so Vite never
   bundles them:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   SUPABASE_SERVICE_ROLE_KEY=...   # Supabase → Project Settings → API (secret)
   IP_HASH_SALT=any-random-string
   ```

   Without `SUPABASE_SERVICE_ROLE_KEY`, limits are kept in memory per function
   instance, which is fine locally but not in production.
4. **Run it.** Restart `npm run dev`, then open the ATS check or the Assistant.
5. **After the demos**, revoke the key in the Anthropic Console, or delete
   `ANTHROPIC_API_KEY` from Vercel and redeploy. Both features then fall back
   to labelled sample output and make no calls.

## Future work

- **Embeddings.** Retrieval is keyword-based, so it misses synonyms outside
  the alias list. Embeddings (for example pgvector) would add a second signal.
- **Per-bullet entries**, so tailoring can pick the best bullets inside a role.
- **Storing postings on applications**, for retrieval over past postings and
  job recommendations.
- **Importing from a URL** (the assistant currently asks for pasted text).

`legacy-demo/` holds the original vanilla HTML/CSS/JS prototype this was
built from, kept for reference.
