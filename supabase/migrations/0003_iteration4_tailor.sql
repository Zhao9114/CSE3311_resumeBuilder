-- Draftly — Iteration 4: the tailoring route.
--
-- "Build tailored resume" is a third AI route, metered and capped like the
-- other two. The only schema change is letting ai_usage record it; the
-- limiter functions take the route as a parameter and need no change.
--
-- The block bank needs no migration: an entry is an ordinary saved_blocks
-- row whose block holds a single item.
--
-- Run once in the Supabase SQL editor AFTER 0001 and 0002 (0002 creates the
-- ai_usage table this changes). Safe to re-run. Touches no user data.

do $$
begin
  if to_regclass('public.ai_usage') is null then
    raise exception 'public.ai_usage does not exist yet: run 0002_iteration3_ai.sql first, then this file.';
  end if;
end
$$;

alter table public.ai_usage drop constraint if exists ai_usage_route_check;
alter table public.ai_usage
  add constraint ai_usage_route_check check (route in ('ats', 'assistant', 'tailor'));
