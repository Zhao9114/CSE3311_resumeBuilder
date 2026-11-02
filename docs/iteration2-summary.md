# Draftly — Iteration 2: What Was Built (source material for the report)

**For the writer:** These are the facts for the Draftly Iteration 2 report (CSE 3311). Use the same structure as the Iteration 1 report:

1. Introduction
2. Project Plan (roadmap, related apps, risks)
3. Specification and Design
4. Code and Tests
5. Customers and Users

Everything below describes code that has been built, committed, pushed and deployed. Items marked **[TEAM TO FILL IN]** are things the code can't tell you, such as user feedback. Don't make them up.

- Team: Jacob Butler, Aashika Sapkota, Huy Thai, Zheng (Yao) Wong
- Repository: github.com/Zhao9114/CSE3311_resumeBuilder (commit `0cca86e` "iteration 2", on `main`)
- Stack: React 18 + TypeScript + Vite, dnd-kit, Supabase (Postgres + Auth), Vitest, deployed on Vercel

---

## 1. Iteration 2 goal (matches the IT1 roadmap row for iteration 2)

The IT1 roadmap listed iteration 2 as **"Supabase login and saving, resume version snapshots"**. The reason given was that this "makes work permanent, and we need snapshots before the tracker can honestly show which resume was sent."

The goal was to make users' work permanent and private, and to make the job tracker's "Resume used" column truthful. It now points at a frozen snapshot of the resume that was actually sent, not at a resume that keeps changing.

Deliberately **not** done (scope guardrails):

- No AI or LLM calls of any kind.
- No real ATS analysis.
- No job recommendations.

The ATS check and the Assistant are still clearly labelled placeholders that make no network request. Those features move to iteration 3, as the roadmap says.

---

## 2. Project plan updates

### 2.1 Roadmap status

| Iteration | Planned | Status |
| --- | --- | --- |
| 1 | Block editor, drag and drop, show/hide, live preview, job tracker, PDF export | Done (IT1) |
| 2 | Supabase login and saving, resume version snapshots | **Done (this iteration)** |
| 3 | AI touch-up and ATS check, grounded in the job posting | Next. The AI stubs and TODO notes were re-tagged `TODO(iteration-3)` and left in place. |
| 4 | Job recommendations and richer analytics | Not started |

**Fix to the IT1 deliverable:** the IT1 ATS placeholder screen said "real analysis arrives in iteration 2", which contradicted the roadmap. It now says iteration 3.

### 2.2 Risks: what iteration 2 did about the ones tagged "Iteration 2"

The IT1 risk table tagged two risks for iteration 2. Both now have concrete mitigations in place.

**Data or security breach** (IT1: p = 0.3, E = 12 hrs, RE = 3.6). Planned mitigation: "Managed login through Supabase, row level security, encryption at rest, and no secrets in the client."

- **Managed login:** Supabase Auth with email and password. The app never stores passwords. The Supabase client library keeps a session token and refreshes it.
- **Row-level security:** turned on for all four tables. Every row has a `user_id` column that the database fills in from the signed-in user's token; the browser never sends it. The policies only allow access to rows where `user_id = auth.uid()`.
  - Signed-out visitors have no table access at all.
  - Resume versions can only be read and created. There is no update or delete permission.
- **Verified with an automated test** against the live database, using two real test accounts. 8 of 8 checks passed (see 4.4).
- **Encryption at rest:** on by default for every Supabase project (AES-256 on the underlying storage). All traffic goes over HTTPS.
- **No secrets in the client:**
  - Only the project URL and the *publishable (anon)* key go into the browser bundle. That key is public by design; row-level security is what protects the data.
  - The app refuses to start if it is given a secret / `service_role` key.
  - Local environment files (`.env.local`, `.env.test.local`) are gitignored and were never committed. On Vercel the keys are set as environment variables in the dashboard.
- **Extra hardening beyond the plan:** an application can only link to a resume version owned by the same user. The database enforces this with a composite foreign key on `(version_id, user_id)`. A plain foreign key would have let a user link to someone else's version by guessing its id, because foreign-key checks bypass row-level security.

**Data cleaning and integration** (IT1: p = 0.4, E = 10 hrs, RE = 4.0, "Iterations 1 and 2"). Planned mitigation: "strict typed data model, input validation on block content, and normalizing data when it is saved."

- **Normalizing on save:** text is trimmed and empty bullet points are dropped. Free-text dates are rewritten into one style. Examples:
  - `05/2027` → `May 2027`
  - `2027-05` → `May 2027`
  - `2024 - current` → `2024 – Present`
  - `jan 2023 to now` → `Jan 2023 – Present`
  - `summer 2025` → `Summer 2025`

  Application dates are forced into `yyyy-mm-dd` form.
- **This runs only when data is saved, never while the user is typing.** Trimming as you type would delete the space the user just pressed; a bug of that kind was fixed in IT1.
- **Defensive parsing on load:** any row read from the database is checked field by field. A malformed row, for example one edited by hand in the dashboard, falls back to safe defaults instead of crashing the preview, and unknown section types are dropped.
- **Database checks as a second layer:**
  - Status must be one of the allowed values.
  - Template id must be one of the five templates.
  - Employer can't be blank.
  - The resume's list of blocks must be an array.

**User-access risk** (ongoing): **[TEAM TO FILL IN]** the feedback round for this iteration.

The AI-related risks (hallucination, API cost and throttling, insecure prompting) are still scheduled for iteration 3. No AI code was added.

---

## 3. Specification and design changes

### 3.1 New inputs and outputs

New inputs:

- Email and password for sign-up and sign-in.
- A name for each saved resume version.
- When adding or editing an application, a choice of which resume version was sent: an existing version, "Snapshot current resume now", or "None recorded".

New outputs:

- Sign-in and sign-up screen.
- Signed-in top bar showing the user's email, a **save-status indicator** ("Saving…", "All changes saved", "Couldn't save — retrying") and a Sign out button.
- **Versions panel** in the builder: each saved version with its name, date and number of sections, plus a Restore button.
- The tracker's **"Resume used"** column now shows the version name and the date it was saved.

### 3.2 Data structures (changes from IT1)

- **New `ResumeVersion` type:** `id`, `resumeId`, `label`, `createdAt`, plus the complete frozen `resume`. It is a full copy, so a version stays readable even if the live resume changes or is deleted.
- **`Application.resumeId` replaced by `Application.versionId`** (string or null). This is the central change of the iteration: an application now points at a frozen version, not the live resume. Editing the resume afterwards can't change what the tracker says was sent.
- **The store interfaces are unchanged for components.** IT1 put all data access behind async store interfaces "so we can add saving without rewriting the components". That paid off: the Supabase stores implement the same interfaces as the in-memory ones, and no component imports Supabase. `main.tsx` picks the implementation at startup:
  - **Demo mode** (no Supabase keys configured): in-memory demo data and no login, exactly like IT1. Handy for graders or anyone without credentials.
  - **Supabase mode** (keys configured): sign-in screen; everything is saved to the user's account.
- **Shared edit logic:** the reorder, show/hide, add, remove and update rules were pulled out into pure functions (`src/store/resumeOps.ts`). The in-memory store and the Supabase store both call them, so the rules exist in one place and the IT1 unit tests now also cover what gets saved.

### 3.3 Database schema (`supabase/migrations/0001_iteration2.sql`)

| Table | Key columns | Notes |
| --- | --- | --- |
| `resumes` | id, user_id, title, template_id, profile (JSON), blocks (JSON array), created_at, updated_at | One row per resume. `blocks` is an ordered JSON array, so array order is page order (the same idea as IT1) and a drag-and-drop reorder is a single-row write. |
| `resume_versions` | id, user_id, resume_id, label, snapshot (JSON), created_at | **Read and create only.** No update or delete permission, plus a database trigger that rejects any update, even from an admin. |
| `applications` | id, user_id, employer, role, status, custom_status, version_id, applied_at | `version_id` is a composite foreign key to `resume_versions(id, user_id)`, so it must be the same user's version. |
| `saved_blocks` | id, user_id, name, tags, block (JSON), saved_at | The IT1 block library, now saved too. |

Every table has row-level security on, and `user_id` is filled in automatically from the signed-in user's login.

**Design decision, with reasons:** blocks are stored as an ordered JSON array on the resume row instead of a separate table per section type.

- The `ResumeBlock` type from IT1 already has a different data shape for each section type. JSON stores that without needing six tables.
- Reordering stays a single write.
- The list's order *is* the page order, the same principle the IT1 design described.

### 3.4 Use cases (updated / new)

**Sign up / sign in.**

- Actor: job seeker.
- Main flow: open the app, see the sign-in screen, create an account or sign in, and land in the builder with their own resume. A brand-new user gets a blank starter resume, never the demo person's content.
- Special cases:
  - If Supabase is set to require email confirmation, sign-up shows "check your email for a confirmation link".
  - Signing out first saves any pending edits.

**Save a resume version** (this is what was promised in IT1's "Tailor resume for a job" use case: "save it as a new version… A tailored version now exists next to the original").

- Main flow: tailor the resume (reorder, hide blocks, edit wording), click **Save version**, name it, and it appears in the Versions panel.
- Result: an immutable copy exists. Later edits to the live resume don't change it.
- Special case: **Restore** copies a version back into the live resume. It asks for confirmation because it replaces the current content, and the version itself is untouched.

**Track job application** (updated). The IT1 use case said "link the resume version used". It is now real:

- When adding an application, the default choice is **"Snapshot current resume now"**. On save, this freezes the resume as a version named "Employer — Role" and links the application to it in one step.
- The user can instead pick an earlier version, or "None recorded".
- Result: the tracker row shows exactly which version was sent, and keeps showing it correctly as the resume changes.

### 3.5 Background saving (design detail worth explaining)

Resume edits fire on every keystroke. Waiting for a network round trip on every key would make typing lag, and replies arriving out of order could put an older version back on screen. So:

1. Each edit is applied immediately to a local copy and shown on screen.
2. About 600 ms after the user stops typing, the whole resume is written to the database.
3. Writes go out one at a time, in order. Each write sends the newest state, so a burst of keystrokes becomes one write.
4. If a write fails, the status shows "Couldn't save — retrying" and it is retried automatically after a few seconds. Nothing is lost.
5. Pending edits are saved before sign-out, and the browser warns if the user tries to close a tab with unsaved edits.

Applications, versions and saved blocks change rarely, so they are written straight away instead.

**[TEAM: add screenshots]**

- Sign-in screen.
- Builder with the "Save version" button and the Versions panel.
- Top bar showing the save status.
- Tracker "Resume used" column with version names.
- Add-application dialog showing "Snapshot current resume now".

---

## 4. Code and tests

### 4.1 What was built this iteration

- Supabase-backed resume, version, application and block-library stores, behind the existing store interfaces.
- Supabase Auth: sign up, sign in, sign out, and signed-out and signed-in screens. The app is gated so a user only sees their own data.
- Row-level security on all tables, the immutability trigger on versions, and the composite foreign key on applications.
- Immutable resume version snapshots, the Save version / Restore UI, and the tracker linked to versions.
- Data normalization on save and defensive parsing on load.
- Background saving with a visible save status.
- The demo mode kept working with no credentials.
- Deployed to Vercel with the Supabase keys set as Vercel environment variables (the team confirmed sign-in works in production).

### 4.2 Main files

| File | Purpose |
| --- | --- |
| `src/store/types.ts` | Store interfaces (the only way components touch data) |
| `src/store/resumeOps.ts` | Pure resume edit functions shared by both stores |
| `src/store/memoryStore.ts` | In-memory stores (demo mode and tests) |
| `src/store/supabaseStore.ts` | Supabase stores, including the background-save logic |
| `src/store/supabaseMappers.ts` | Converts between database rows and the app's data types |
| `src/store/normalize.ts` | Cleans data on save, checks data on load |
| `src/store/StoreProvider.tsx` | React hooks: `useResume`, `useApplications`, `useBlockLibrary`, `useVersions`, `useSyncStatus` |
| `src/lib/supabase.ts` | Supabase client setup; refuses secret keys |
| `src/features/auth/*` | Sign-in state, sign-in screen, and the gate that shows it |
| `src/features/editor/VersionsPanel.tsx`, `SaveVersionModal.tsx` | Versions UI |
| `src/features/tracker/*` | Tracker linked to versions |
| `supabase/migrations/0001_iteration2.sql` | Tables, row-level security policies, triggers, permissions |

### 4.3 How to compile, run and test

Prerequisites: Node.js 18+ and npm.

```
git clone https://github.com/Zhao9114/CSE3311_resumeBuilder.git
cd CSE3311_resumeBuilder
npm install
npm run dev        # app at http://localhost:5173 (demo mode until .env.local exists)
npm run build      # type-check + production build; passes with no TypeScript errors
npm test           # unit tests (no network)
npm run test:rls   # row-level security checks against the real Supabase project
```

To run against Supabase: copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable key). The full Supabase setup steps are in the README under "Supabase setup".

### 4.4 Tests

**Results:**

- `npm test`: **43 tests passed**, in 5 test files.
- `npm run test:rls`: **8 passed** against the live Supabase project. The 1 skipped item is only the note shown when credentials are missing.

| Test file | What it covers (functions) |
| --- | --- |
| `memoryStore.test.ts` (IT1 targets) | Block reorder (`reorderBlocks`), show/hide (`toggleBlock`), application stats (`isInProgress`), empty custom status falls back to "Custom" (`statusLabel`, `update`) |
| `versions.test.ts` | **Save/load round trip** (`ResumeStore.save`/`get`). **Snapshot immutability**: after every kind of edit to the live resume (reorder, hide, profile edit, block edit, add section) the stored version is unchanged, and changing the objects the store returns can't alter it either. **Tracker resolution** (`resumeUsedLabel`): each application resolves to the version it was sent with, even after the resume keeps changing; a missing or null version shows "—" or "Unknown version". The seeded demo data stays consistent. |
| `supabaseMappers.test.ts` | Database round trip for resumes, versions, applications and saved blocks: what is written is what is read back, including block order and show/hide state |
| `supabaseStore.test.ts` | Background saving, against a fake Supabase client: a new user gets exactly one starter resume even if two loads start at once; a burst of edits becomes one write of the newest state; a reload reads back what was saved; a failed write is retried and the status goes saving → error → saved |
| `normalize.test.ts` | Date normalization cases, application date handling, trimming and empty-bullet removal, and malformed rows falling back to safe defaults |
| `rls.integration.test.ts` | Against the **real database** with two test accounts. The owner can read their resume. Another user **cannot read, update or delete** it, or create a row in the owner's name. Another user **cannot see** the owner's versions or **link an application** to them. Versions **cannot be edited** even by their owner. A signed-out visitor sees **nothing** in any table. |

RLS test output from the team's run:

```
✓ src/store/rls.integration.test.ts (9 tests | 1 skipped) 3585ms
   ✓ row-level security (8)
     ✓ the owner can read their own resume
     ✓ another user cannot read it
     ✓ another user cannot change or delete it
     ✓ a user cannot insert a row on someone else's behalf
     ✓ another user cannot see the owner's versions
     ✓ a user cannot link an application to someone else's version
     ✓ versions are immutable, even for their owner
     ✓ a signed-out visitor sees nothing at all
 Tests  8 passed | 1 skipped (9)
```

### 4.5 Comments

The trickiest code has comments explaining **why**, not just what it does:

- **Background-save logic** (`supabaseStore.ts`): why edits are written later, why writes are one at a time, why failed writes are retried.
- **Snapshot immutability** (`memoryStore.ts`, `types.ts`, the SQL trigger): why versions have no update or delete.
- **Normalize vs. parse** (`normalize.ts`): why cleaning happens only on save.
- **Store interfaces and provider:** why components never touch Supabase.
- **SQL migration:** why `user_id` is filled in automatically and why the composite foreign key exists.

---

## 5. Customers and users

**[TEAM TO FILL IN]** The rubric rewards showing real user interaction. Include:

- How many people were asked.
- How they were asked (in person or through a form).
- Quotes, each with who said it and the date.
- At least one thing the feedback changed.

Iteration 2 features worth asking users about:

- Does "Snapshot current resume now" match how they actually apply?
- Is the save-status indicator reassuring?
- Is sign-up friction acceptable?
- Do they understand the difference between a version and the live resume?

Keep the user groups the same as in IT1:

- Young adults (18–25) writing their first resume.
- College juniors and seniors tailoring a resume for many applications.

---

## 6. Notes and limitations (for honesty in the report)

- **AI features:** ATS and the Assistant are still placeholders with fixed sample output and no network request. This is intentional, per the roadmap.
- **One live resume per user:** tailored variants are kept as versions rather than as separate editable resumes. This matches the IT1 "save as a new version" use case. There is no switcher between multiple live resumes.
- **Versions are permanent:** they can't be deleted from the UI or by row-level security. This is by design, so a tracked application can never lose its record.
- **Email confirmation:** depends on the Supabase "Confirm email" setting. The app handles both on and off.
- **What was tested how:**
  - The automated tests use the in-memory stores and a fake Supabase client.
  - The row-level security test uses the real database.
  - Sign-in on the Vercel deployment was confirmed by the team. **[TEAM TO CONFIRM]** whether the other UI flows were also checked by hand (editing and reloading, saving a version, linking it in the tracker), and say so in the report only if they were.
