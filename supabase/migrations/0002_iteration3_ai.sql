-- Draftly — iteration 3: AI usage ledger, rate limits and spend cap.
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Every model call the serverless functions make is logged here with its
-- token count and dollar cost. The same table drives the limits: before a
-- call, ai_try_consume() counts the caller's recent rows and the running
-- total, and refuses if either is over. Only the server (service-role key)
-- can touch any of it.

-- ── ai_usage ────────────────────────────────────────────────────────────────

create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  -- 'user:<uuid>' for a signed-in caller, 'ip:<salted sha-256>' otherwise.
  -- Raw IP addresses are never stored.
  identity      text not null,
  route         text not null check (route in ('ats', 'assistant')),
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(12, 6) not null default 0
);

create index if not exists ai_usage_identity_created_idx
  on public.ai_usage (identity, created_at desc);

-- RLS on with no policies, and no grants: browsers (anon or signed in) can
-- neither read the ledger nor write themselves a bigger allowance. The
-- service role bypasses RLS, and only the serverless functions hold it.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- ── ai_try_consume ──────────────────────────────────────────────────────────
-- Reserve a slot for one request, or say why not. Returns one row:
--   ('ok', <usage id>) | ('rate_limited', null) | ('budget_exhausted', null)
--
-- The advisory lock serialises requests from one identity, so two parallel
-- requests can't both pass a limit that only has room for one. The budget
-- check is not serialised across identities; the overshoot that allows is a
-- few in-flight calls at about $0.001 each, which the gap between
-- AI_BUDGET_USD and the Console's hard limit absorbs.

create or replace function public.ai_try_consume(
  p_identity     text,
  p_route        text,
  p_daily_limit  integer,
  p_minute_limit integer,
  p_budget_usd   numeric
)
returns table (status text, usage_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spent  numeric;
  v_day    integer;
  v_minute integer;
  v_id     bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || p_identity));

  select coalesce(sum(u.cost_usd), 0) into v_spent from public.ai_usage u;
  if v_spent >= p_budget_usd then
    return query select 'budget_exhausted'::text, null::bigint;
    return;
  end if;

  select count(*) into v_day
    from public.ai_usage u
   where u.identity = p_identity and u.created_at > now() - interval '24 hours';
  select count(*) into v_minute
    from public.ai_usage u
   where u.identity = p_identity and u.created_at > now() - interval '1 minute';
  if v_day >= p_daily_limit or v_minute >= p_minute_limit then
    return query select 'rate_limited'::text, null::bigint;
    return;
  end if;

  insert into public.ai_usage (identity, route)
  values (p_identity, p_route)
  returning id into v_id;

  return query select 'ok'::text, v_id;
end;
$$;

-- ── ai_record_usage ─────────────────────────────────────────────────────────
-- Add a finished call's real tokens and cost to its reserved row. Adds rather
-- than sets, because one assistant request can make two model calls.

create or replace function public.ai_record_usage(
  p_usage_id      bigint,
  p_input_tokens  integer,
  p_output_tokens integer,
  p_cost_usd      numeric
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens  = input_tokens + p_input_tokens,
         output_tokens = output_tokens + p_output_tokens,
         cost_usd      = cost_usd + p_cost_usd
   where id = p_usage_id;
$$;

-- Functions are executable by PUBLIC by default; only the server may call these.
revoke execute on function public.ai_try_consume(text, text, integer, integer, numeric) from public, anon, authenticated;
revoke execute on function public.ai_record_usage(bigint, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.ai_try_consume(text, text, integer, integer, numeric) to service_role;
grant execute on function public.ai_record_usage(bigint, integer, integer, numeric) to service_role;

-- ── Spend report ────────────────────────────────────────────────────────────
-- Paste into the SQL editor any time to see where the budget went:
--
--   select route, count(*) as calls, sum(input_tokens) as input_tokens,
--          sum(output_tokens) as output_tokens, sum(cost_usd) as usd
--     from public.ai_usage group by route
--   union all
--   select 'total', count(*), sum(input_tokens), sum(output_tokens), sum(cost_usd)
--     from public.ai_usage;
