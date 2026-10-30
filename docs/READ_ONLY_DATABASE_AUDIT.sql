-- Four Flavours public website — READ-ONLY database audit
-- Purpose: inspect current settings, reviews, gallery assets, RLS, grants and storage policy setup.
-- Safety: every executable statement below is a SELECT. This script does not insert, update, delete,
-- create, alter, grant, revoke, or otherwise mutate database state.
-- Run in Supabase Dashboard → SQL Editor. If the editor only displays the final result grid,
-- execute one SELECT block at a time and share each result grid. Do not share private keys/tokens.

-- 1. Connection and PostgreSQL version (no secrets returned).
select current_database() as database_name,
       current_user as executing_role,
       current_setting('server_version') as postgres_version,
       now() as audited_at;

-- 2. Confirm expected application tables exist.
select expected.table_name,
       case when actual.table_name is null then 'MISSING' else 'present' end as audit_status
from (values
  ('site_settings'), ('reviews'), ('media_assets'), ('cuisine_sections'), ('user_roles'),
  ('booking_requests'), ('contact_messages')
) as expected(table_name)
left join information_schema.tables actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
 and actual.table_type = 'BASE TABLE'
order by expected.table_name;

-- 3. Inspect the actual public columns for the application tables (useful for spotting source/DB drift).
select table_name, ordinal_position, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('site_settings','reviews','media_assets','cuisine_sections','user_roles','booking_requests','contact_messages')
order by table_name, ordinal_position;

-- 4. Current public website settings and Google review wiring. Does not return any API keys.
select id,
       brand_name,
       google_review_url,
       map_url,
       social_links ->> 'googleBusiness' as google_business_url,
       theme ->> 'hero_shape' as hero_shape,
       theme ->> 'story_shape' as story_shape,
       theme ->> 'cuisine_shape' as cuisine_shape,
       theme ->> 'gallery_shape' as gallery_shape,
       updated_at
from public.site_settings
where id = 1;

-- 5. Review moderation counts and rating summary. Text and guest names are deliberately omitted.
select status,
       count(*) as review_count,
       count(*) filter (where consent_publication is true) as with_publication_consent,
       round((avg(rating) filter (where status = 'approved' and consent_publication is true))::numeric, 2) as approved_average_rating,
       max(created_at) as most_recent_review_at
from public.reviews
group by status
order by status;

-- 6. Media inventory by kind and publication state.
select kind, status, count(*) as asset_count,
       count(*) filter (where coalesce(trim(public_url), '') <> '') as assets_with_public_url,
       max(updated_at) as last_updated_at
from public.media_assets
group by kind, status
order by kind, status;

-- 7. Recent published gallery assets only (public-facing URLs/alt text, not file credentials).
select id, title, alt_text, public_url, storage_path, kind, status, created_at, updated_at
from public.media_assets
where kind = 'gallery' and status = 'published'
order by updated_at desc nulls last
limit 30;

-- 8. RLS enabled/forced state for the app tables.
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','p')
  and c.relname in ('site_settings','reviews','media_assets','cuisine_sections','user_roles','booking_requests','contact_messages')
order by c.relname;

-- 9. Policies and their expressions for the relevant tables. Read-only catalog inspection.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public','storage')
  and (
    tablename in ('site_settings','reviews','media_assets','cuisine_sections','user_roles','booking_requests','contact_messages')
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;

-- 10. Table-level grants for API-facing application tables.
select grantee, table_schema, table_name, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('site_settings','reviews','media_assets','cuisine_sections','user_roles','booking_requests','contact_messages')
  and grantee in ('anon','authenticated','service_role','postgres')
order by table_name, grantee, privilege_type;

-- 11. Storage bucket setup. A missing row means the expected bucket may not have been created.
select id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
from storage.buckets
where id = 'website-media' or name = 'website-media';

-- 12. Admin role counts only; no user IDs or email addresses are exposed.
select role, count(*) as user_count
from public.user_roles
group by role
order by role;

-- 13. Verify the admin authorization helper exists and has SECURITY DEFINER enabled.
select n.nspname as function_schema,
       p.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_configuration
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_admin','set_updated_at')
order by p.proname;

-- 14. Check for accidentally-created secret-like columns in public.site_settings by column NAME only.
-- This does not read or expose any field values.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'site_settings'
  and column_name ~* '(api.?key|secret|access.?token|private.?key|password|credential)'
order by column_name;

-- End of read-only audit. Do not run any migration or security change until these results are reviewed.
