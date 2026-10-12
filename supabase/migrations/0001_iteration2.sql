-- Draftly — iteration 2 schema.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: tables use IF NOT EXISTS and policies are dropped first.
--
-- Every table carries user_id, defaulted from the caller's JWT, and row-level
-- security limits every read and write to rows where user_id = auth.uid().
-- The browser never sends user_id itself, so it cannot claim someone else's.

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Snapshots are evidence of what was sent to an employer, so they must never
-- change after the fact. RLS already grants no UPDATE, but this trigger also
-- stops anyone with elevated rights (dashboard, service role) from editing.
create or replace function public.forbid_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'resume_versions rows are immutable';
end;
$$;

-- ─── resumes ────────────────────────────────────────────────────────────────
-- One row per live resume. `blocks` is an ordered JSON array: array order is
-- render order, so a drag-and-drop reorder is a single-row write.

create table if not exists public.resumes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'My resume',
  template_id text not null default 'classic'
              check (template_id in ('classic', 'modern', 'compact', 'elegant', 'sidebar')),
  profile     jsonb not null default '{}'::jsonb,
  blocks      jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resumes_user_id_idx on public.resumes (user_id);

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

-- ─── resume_versions ────────────────────────────────────────────────────────
-- Point-in-time copies of a resume. `snapshot` holds the whole Resume, so a
-- version stays readable even if the live resume is later deleted.

create table if not exists public.resume_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resume_id  uuid references public.resumes (id) on delete set null,
  label      text not null,
  snapshot   jsonb not null,
  created_at timestamptz not null default now(),
  -- Lets applications reference (id, user_id) together, see below.
  unique (id, user_id)
);

create index if not exists resume_versions_user_id_idx on public.resume_versions (user_id);

drop trigger if exists resume_versions_immutable on public.resume_versions;
create trigger resume_versions_immutable
  before update on public.resume_versions
  for each row execute function public.forbid_version_update();

-- ─── applications ───────────────────────────────────────────────────────────

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  employer      text not null check (length(trim(employer)) > 0),
  role          text not null default '',
  status        text not null
                check (status in ('Applied', 'Interview', 'Waitlist', 'Hold',
                                  'Accepted', 'Rejected', 'Declined', 'Custom')),
  custom_status text,
  version_id    uuid,
  applied_at    date not null default current_date,
  created_at    timestamptz not null default now(),
  -- Composite key: an application may only point at a version owned by the
  -- same user. Foreign-key checks bypass RLS, so a plain FK on version_id
  -- alone would let a user link to someone else's version by guessing its id.
  foreign key (version_id, user_id) references public.resume_versions (id, user_id)
);

create index if not exists applications_user_id_idx on public.applications (user_id);

-- ─── saved_blocks (block library) ───────────────────────────────────────────

create table if not exists public.saved_blocks (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name     text not null,
  tags     text[] not null default '{}',
  block    jsonb not null,
  saved_at timestamptz not null default now()
);

create index if not exists saved_blocks_user_id_idx on public.saved_blocks (user_id);

-- ─── Privileges ─────────────────────────────────────────────────────────────
-- Signed-out visitors (anon) get nothing. Signed-in users get table access,
-- which RLS below then narrows to their own rows. Versions get no UPDATE or
-- DELETE at all.

revoke all on public.resumes, public.resume_versions, public.applications, public.saved_blocks from anon;

grant select, insert, update, delete on public.resumes      to authenticated;
grant select, insert                 on public.resume_versions to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.saved_blocks to authenticated;

-- ─── Row-level security ─────────────────────────────────────────────────────
-- `(select auth.uid())` is evaluated once per query instead of once per row.

alter table public.resumes         enable row level security;
alter table public.resume_versions enable row level security;
alter table public.applications    enable row level security;
alter table public.saved_blocks    enable row level security;

-- resumes
drop policy if exists "resumes: owner can read"   on public.resumes;
drop policy if exists "resumes: owner can insert" on public.resumes;
drop policy if exists "resumes: owner can update" on public.resumes;
drop policy if exists "resumes: owner can delete" on public.resumes;
create policy "resumes: owner can read"   on public.resumes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "resumes: owner can insert" on public.resumes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "resumes: owner can update" on public.resumes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "resumes: owner can delete" on public.resumes for delete to authenticated
  using (user_id = (select auth.uid()));

-- resume_versions: read and insert only — no update, no delete.
drop policy if exists "versions: owner can read"   on public.resume_versions;
drop policy if exists "versions: owner can insert" on public.resume_versions;
create policy "versions: owner can read"   on public.resume_versions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "versions: owner can insert" on public.resume_versions for insert to authenticated
  with check (user_id = (select auth.uid()));

-- applications
drop policy if exists "applications: owner can read"   on public.applications;
drop policy if exists "applications: owner can insert" on public.applications;
drop policy if exists "applications: owner can update" on public.applications;
drop policy if exists "applications: owner can delete" on public.applications;
create policy "applications: owner can read"   on public.applications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "applications: owner can insert" on public.applications for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "applications: owner can update" on public.applications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "applications: owner can delete" on public.applications for delete to authenticated
  using (user_id = (select auth.uid()));

-- saved_blocks
drop policy if exists "saved_blocks: owner can read"   on public.saved_blocks;
drop policy if exists "saved_blocks: owner can insert" on public.saved_blocks;
drop policy if exists "saved_blocks: owner can update" on public.saved_blocks;
drop policy if exists "saved_blocks: owner can delete" on public.saved_blocks;
create policy "saved_blocks: owner can read"   on public.saved_blocks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "saved_blocks: owner can insert" on public.saved_blocks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "saved_blocks: owner can update" on public.saved_blocks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "saved_blocks: owner can delete" on public.saved_blocks for delete to authenticated
  using (user_id = (select auth.uid()));
