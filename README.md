# Draftly

A block-based resume builder with drag-and-drop sections, a live preview, and
a job application tracker.

Iteration 1 built the full UI and the drag-and-drop editor. Iteration 2 makes
the work permanent and private: Supabase login, saving to Supabase behind the
existing store interfaces, row-level security, and immutable **resume
versions** that the job tracker links to. That way "Resume used" shows exactly
what was sent. There is still no AI or LLM code; that comes in iteration 3.

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
`npm run build` producing `dist/`. Add the same two `VITE_SUPABASE_*`
environment variables in the Vercel project settings.

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
  components/   TopBar, Modal, useReducedMotion
  services/     ats.ts, assistant.ts: typed stubs only, see below
supabase/migrations/  SQL for the tables, RLS policies and triggers
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

## Saved blocks

Any section can be saved to the block library with a name and tags — keep an
`Experience — Frontend` and an `Experience — Backend`, then insert whichever
suits the posting. Inserting adds a **copy**: the saved entry is cloned on
save and again on insert, so editing the resume afterwards never writes back
into the library.

The library lives behind `BlockLibraryStore`, alongside the other stores, and
is exposed as the `useBlockLibrary` hook. In Supabase mode it is saved to the
`saved_blocks` table.

## Placeholder screens

Two surfaces are deliberately fake until iteration 3. Both say so on screen,
and neither makes a network request:

- **ATS check** (`src/features/ats/AtsPanel.tsx`) renders a fixed sample
  result. The real call goes through `atsService.analyze` in
  `src/services/ats.ts`.
- **Assistant** (`src/features/assistant/AssistantDrawer.tsx`) is a chat
  drawer with scripted replies. The real call goes through
  `assistantService.send` in `src/services/assistant.ts`, whose
  `AssistantMessage.proposed` field is where generated blocks will arrive.

## Tests

`npm test` runs everything below except the RLS suite, with no network access.

| File | What it covers |
| --- | --- |
| `src/store/memoryStore.test.ts` | Block reorder (`reorderBlocks`), show/hide (`toggleBlock`), application stats (`isInProgress`), empty custom status falling back to "Custom" (`statusLabel`, `update`) |
| `src/store/versions.test.ts` | Save/load round trip (`ResumeStore.save`/`get`); snapshot immutability (`ResumeVersionStore.snapshot` after every kind of live edit, and after mutating returned objects); tracker resolution (`resumeUsedLabel`) to the right version as the resume changes; seed data still consistent |
| `src/store/supabaseMappers.test.ts` | Database round trip: `resumeToRow`/`resumeFromRow`, `versionToRow`/`versionFromRow`, `applicationToRow`/`applicationFromRow`, `savedBlockToRow`/`savedBlockFromRow`, preserving block order and visibility |
| `src/store/supabaseStore.test.ts` | `SupabaseResumeStore` on a fake client: exactly one starter resume for a new user, a burst of edits collapsing into one write of the newest state, reload matching what was saved, and a failed write being retried (`flush`, sync status) |
| `src/store/normalize.test.ts` | `normalizeDateText`, `normalizeIsoDate`, `normalizeResume`, `normalizeApplication`, and `parseResume`/`parseBlock` on malformed rows |
| `src/store/rls.integration.test.ts` | `npm run test:rls`: against the real database, with two test users. Another user can't read, update, delete or insert-as the owner's rows; can't see or link to their versions; versions can't be edited; signed-out visitors see nothing |

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

## Not in iteration 2

ATS checking, the assistant, and any LLM or API call remain out of scope until
iteration 3. Both have typed seams marked `TODO(iteration-3)`:

| Seam | Location |
| --- | --- |
| ATS analysis | `src/services/ats.ts`, `src/features/ats/AtsPanel.tsx` |
| Assistant / block generation | `src/services/assistant.ts`, `src/features/assistant/AssistantDrawer.tsx` |

`legacy-demo/` holds the original vanilla HTML/CSS/JS prototype this was
built from, kept for reference.
