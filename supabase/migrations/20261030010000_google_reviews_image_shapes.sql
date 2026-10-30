-- Four Flavours: Google review destination + image-frame defaults
-- DATA-ONLY, idempotent migration. No tables/columns/policies/functions are created or altered.
-- Safe to run once the existing public.site_settings table from MASTER_MIGRATION.sql exists.
-- Existing non-empty Google review URL and existing shape selections are preserved.

begin;

do $$
begin
  if to_regclass('public.site_settings') is null then
    raise exception 'public.site_settings does not exist. Run or review the master migration first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings'
      and column_name = 'google_review_url'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings'
      and column_name = 'theme'
  ) then
    raise exception 'Expected google_review_url and theme columns are missing from public.site_settings; no changes applied.';
  end if;
end $$;

update public.site_settings
set google_review_url = case
      when nullif(btrim(google_review_url), '') is null
        then 'https://g.page/r/CRtD8Ec3oW3BEAE/review'
      else google_review_url
    end,
    theme = coalesce(theme, '{}'::jsonb) || jsonb_build_object(
      'hero_shape', coalesce(nullif(theme ->> 'hero_shape', ''), 'arch'),
      'story_shape', coalesce(nullif(theme ->> 'story_shape', ''), 'classic'),
      'cuisine_shape', coalesce(nullif(theme ->> 'cuisine_shape', ''), 'arch'),
      'gallery_shape', coalesce(nullif(theme ->> 'gallery_shape', ''), 'rounded')
    )
where id = 1;

commit;

-- Expected result: one settings row updated. If zero rows were updated, inspect site_settings for id = 1.
-- This migration does not configure the Google Places API key or deploy the Edge Function.
