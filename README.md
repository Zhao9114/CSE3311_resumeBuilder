# Draftly

A block-based resume builder with drag-and-drop sections, a live preview, and
a job application tracker.

Iteration 1 is the full UI and the drag-and-drop editor. State lives in memory
behind a data-layer interface, so persistence can be added without a rewrite.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # serve the built output
```

Deploying to Vercel needs no configuration: it is a standard Vite app at the
repo root, with `npm run build` producing `dist/`.

## How it is put together

```
src/
  types/        data contracts (Resume, ResumeBlock, Application)
  store/        ResumeStore / ApplicationStore interfaces + in-memory impls
  data/seed.ts  the seeded resume and applications
  features/
    editor/     block list, per-section forms, drag-and-drop, resume paper
    tracker/    applications table, stats, add/edit modal
  components/   TopBar, Modal, useReducedMotion
  services/     ats.ts — typed stub only, see below
```

Two ideas carry most of the weight:

**`ResumeBlock` is a discriminated union.** Narrowing on `block.type` also
narrows `block.data`, so each branch of the editor and the preview gets its own
typed payload with no casts.

**Custom sections.** The five built-in types are capped at one each, but a
resume can carry any number of `custom` blocks with user-written titles.
`isRepeatable` in `src/types/resume.ts` is what distinguishes them, and
`addBlock` only dedupes the non-repeatable kinds.

**Components never touch state directly.** Every read and write goes through
`ResumeStore` / `ApplicationStore`, exposed as the `useResume` and
`useApplications` hooks. Both interfaces are fully async and both hooks already
surface `loading` and `error`, so swapping the in-memory implementation for a
network-backed one needs no component changes.

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

## Export PDF

The Export PDF button switches to the builder and calls `window.print()`. A
print stylesheet hides the app chrome so only the resume paper prints, with
page margins and `break-inside: avoid` on sections and items.

## Not in iteration 1

ATS checking, any LLM or API call, real auth, Supabase reads and writes, and
resume version snapshots are all out of scope. Each has a typed seam marked
`TODO(iteration-2)`:

| Seam | Location |
| --- | --- |
| Supabase-backed stores | `src/store/types.ts`, `src/store/StoreProvider.tsx` |
| ATS analysis | `src/services/ats.ts` |
| Resume version snapshots | `src/store/types.ts` |
| Auth | `src/store/types.ts` |

`legacy-demo/` holds the original vanilla HTML/CSS/JS prototype this was
built from, kept for reference.
