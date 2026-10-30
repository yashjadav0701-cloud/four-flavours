-- Four Flavours: hard daily guard for billable Google Places review requests.
-- This stores ONLY one count per UTC day, never Google review text or other Places content.
-- Run this migration before deploying the updated google-reviews Edge Function.

begin;

create table if not exists public.google_reviews_daily_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.google_reviews_daily_usage enable row level security;
revoke all on table public.google_reviews_daily_usage from public, anon, authenticated, service_role;

create or replace function public.consume_google_reviews_daily_budget()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consumed boolean;
begin
  -- Conservative global-safe cap: at most 25 Google requests per UTC day.
  -- 25/day is at most 775 in a 31-day month, below the 1,000/month general
  -- Enterprise + Atmosphere free cap, assuming no other usage consumes that SKU.
  insert into public.google_reviews_daily_usage as daily_usage
    (usage_date, request_count, updated_at)
  values
    ((pg_catalog.timezone('UTC', pg_catalog.now()))::date, 1, pg_catalog.now())
  on conflict (usage_date) do update
    set request_count = daily_usage.request_count + 1,
        updated_at = pg_catalog.now()
    where daily_usage.request_count < 25
  returning true into v_consumed;

  return coalesce(v_consumed, false);
end;
$function$;

revoke all on function public.consume_google_reviews_daily_budget() from public;
revoke all on function public.consume_google_reviews_daily_budget() from anon, authenticated;
grant execute on function public.consume_google_reviews_daily_budget() to service_role;

commit;

-- Verification (optional):
-- select usage_date, request_count, updated_at
-- from public.google_reviews_daily_usage
-- order by usage_date desc limit 7;
-- The table has no client-facing policy; only the server's Supabase secret key can invoke the RPC.
