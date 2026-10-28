-- Four Flavours master migration
-- Target: Supabase PostgreSQL + Supabase Auth + Supabase Storage
-- Apply in Supabase Dashboard -> SQL Editor. For CLI use, initialize and link the Supabase CLI project first.
-- Safe to re-run: tables, functions, seeds and policies are guarded/idempotent.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Only explicitly promoted Supabase Auth users can administer website data.
-- This table is intentionally not writable through the public client API.
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  brand_name text not null default 'Four Flavours' check (char_length(brand_name) between 1 and 100),
  tagline text not null default 'A world of flavours in every plate.' check (char_length(tagline) <= 180),
  announcement text not null default 'Four cuisines. One unforgettable table.' check (char_length(announcement) <= 180),
  logo_url text not null default '',
  favicon_url text not null default 'assets/icons/favicon.svg',
  brand_icon text not null default '4',
  hero_eyebrow text not null default 'A LITTLE OF EVERYTHING. A LOT TO LOVE.' check (char_length(hero_eyebrow) <= 180),
  hero_title text not null default E'Four cuisines.\nOne unforgettable\ntable.' check (char_length(hero_title) between 1 and 220),
  hero_description text not null default 'From familiar favourites to delicious new discoveries, pull up a chair and find your next favourite. Good food tastes even better together.' check (char_length(hero_description) <= 1200),
  hero_image_url text not null default 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1800&q=88',
  hero_image_alt text not null default 'A colourful spread of freshly prepared food' check (char_length(hero_image_alt) <= 240),
  hero_cta_label text not null default 'Explore the flavours' check (char_length(hero_cta_label) <= 80),
  story_eyebrow text not null default 'MORE THAN WHAT’S ON THE PLATE' check (char_length(story_eyebrow) <= 180),
  story_title text not null default E'A good meal\nis never just\na meal.' check (char_length(story_title) <= 220),
  story_body text not null default 'It is the catch-up that runs late, the first bite everyone wants to try, and the table where nobody checks the time. Four Flavours is built around a simple idea: the best moments happen when we share them.' check (char_length(story_body) <= 2000),
  story_image_url text not null default 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85',
  review_title text not null default E'Don’t just take\nour word for it.' check (char_length(review_title) <= 220),
  review_subtitle text not null default 'Every visit has a story. Read honest guest notes, then come write your own.' check (char_length(review_subtitle) <= 800),
  gallery_title text not null default E'A little look\naround the table.' check (char_length(gallery_title) <= 220),
  gallery_subtitle text not null default 'Food, atmosphere and little details that make a visit feel special.' check (char_length(gallery_subtitle) <= 800),
  visit_title text not null default E'A table starts\nwith a call.' check (char_length(visit_title) <= 220),
  visit_subtitle text not null default 'Call us directly to check availability and arrange your table. We look forward to welcoming you.' check (char_length(visit_subtitle) <= 800),
  address text not null default 'Vadodara, Gujarat · Add the verified street address in the admin studio.',
  phone text not null default '',
  email text not null default '',
  opening_hours text not null default 'Please contact the restaurant to confirm today’s hours.',
  map_url text not null default 'https://www.google.com/maps/search/?api=1&query=Four+Flavours+restaurant+Vadodara+Gujarat',
  google_review_url text not null default '',
  booking_enabled boolean not null default true,
  social_links jsonb not null default '{"instagram":"","facebook":"","whatsapp":"","youtube":"","googleBusiness":""}'::jsonb,
  theme jsonb not null default '{"accent":"#B64F38","accent_dark":"#8E3828","paper":"#F6F0E6","paper_deep":"#EEE5D8","ink":"#20211D","ink_soft":"#52534B","olive":"#53664E","gold":"#D4A74F","surface":"#FFFDF8","line":"#D6CFC1","logo_width":280}'::jsonb,
  meta_title text not null default 'Four Flavours | A world of flavours in every plate',
  meta_description text not null default 'Discover Four Flavours: four cuisine traditions, warm hospitality, honest guest reviews and a table waiting for you in Vadodara.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cuisine_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,50}$'),
  sort_order integer not null default 0,
  eyebrow text not null default '' check (char_length(eyebrow) <= 180),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 800),
  image_url text not null default '',
  image_alt text not null default '' check (char_length(image_alt) <= 240),
  icon_name text not null default 'Sparkles' check (char_length(icon_name) <= 60),
  accent_color text not null default '#C66A3D' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  alt_text text not null default '' check (char_length(alt_text) <= 240),
  public_url text not null,
  storage_path text,
  kind text not null default 'gallery' check (kind in ('logo','favicon','hero','story','cuisine','gallery','icon','other')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  licence_notes text not null default '' check (char_length(licence_notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'Guest' check (char_length(display_name) between 1 and 70),
  rating smallint not null check (rating between 1 and 5),
  feeling text not null default 'Loved it' check (char_length(feeling) between 1 and 60),
  review_text text not null check (char_length(review_text) between 12 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  consent_publication boolean not null default false,
  consent_version text not null default '2026-10-v1',
  highlight boolean not null default false,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  phone text not null check (char_length(phone) between 8 and 24 and phone ~ '^[+0-9 ()-]+$'),
  email text check (email is null or char_length(email) <= 254),
  party_size smallint not null default 2 check (party_size between 1 and 30),
  requested_date date not null check (requested_date >= current_date),
  requested_time text not null check (requested_time in ('12:00','13:00','14:00','18:00','19:00','20:00','21:00','flexible')),
  message text check (message is null or char_length(message) <= 700),
  privacy_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','contacted','confirmed','cancelled','completed')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null default '' check (char_length(phone) <= 24),
  subject text not null default 'Website enquiry' check (char_length(subject) between 2 and 180),
  message text not null check (char_length(message) between 5 and 2000),
  privacy_consent boolean not null default false,
  status text not null default 'new' check (status in ('new','read','replied','closed','spam')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The website is a single restaurant, so one settings row is seeded by the master migration.
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- Keep defaults and the original starter row aligned on an earlier starter deployment.
-- Each update only touches a value that still exactly matches the old starter default.
alter table public.site_settings alter column favicon_url set default 'assets/icons/favicon.svg';
alter table public.site_settings alter column brand_icon set default '4';
alter table public.site_settings alter column hero_title set default E'Four cuisines.\nOne unforgettable\ntable.';
alter table public.site_settings alter column story_title set default E'A good meal\nis never just\na meal.';
alter table public.site_settings alter column review_title set default E'Don’t just take\nour word for it.';
alter table public.site_settings alter column gallery_title set default E'A little look\naround the table.';
alter table public.site_settings alter column visit_title set default E'A table starts\nwith a call.';
update public.site_settings set favicon_url = 'assets/icons/favicon.svg' where id = 1 and favicon_url = '/favicon.svg';
update public.site_settings set brand_icon = '4' where id = 1 and brand_icon = 'Sparkles';
update public.site_settings set hero_title = E'Four cuisines.\nOne unforgettable\ntable.' where id = 1 and hero_title = E'Four cuisines.\nOne unforgettable table.';
update public.site_settings set story_title = E'A good meal\nis never just\na meal.' where id = 1 and story_title = 'A good meal is never just a meal.';
update public.site_settings set review_title = E'Don’t just take\nour word for it.' where id = 1 and review_title = 'Don’t just take our word for it.';
update public.site_settings set gallery_title = E'A little look\naround the table.' where id = 1 and gallery_title = 'A little look around the table.';
update public.site_settings set visit_title = E'A table starts\nwith a call.' where id = 1 and (visit_title = E'Shall we\nsave you a seat?' or visit_title = 'Shall we save you a seat?');
update public.site_settings set visit_subtitle = 'Call us directly to check availability and arrange your table. We look forward to welcoming you.' where id = 1 and visit_subtitle = 'Tell us when you are coming. Our team will get back to you to confirm availability.';

insert into public.cuisine_sections (slug, sort_order, eyebrow, title, description, image_url, image_alt, icon_name, accent_color, is_active)
values
 ('indian', 1, '01 / WARM & SOULFUL', 'Indian', 'Familiar favourites, aromatic spices and layers of flavour worth slowing down for.', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1000&q=85', 'Indian curry with herbs and spices', 'Flame', '#D97745', true),
 ('chinese', 2, '02 / BOLD & WOK-FIRED', 'Chinese', 'Big textures, savoury notes and the delicious energy of a dish fresh from the wok.', 'https://images.unsplash.com/photo-1760699609029-01bcc566ab50?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000', 'Chinese noodles with dumplings and fresh greens', 'FlameKindling', '#C65446', true),
 ('continental', 3, '03 / SIMPLE & REFINED', 'Continental', 'Thoughtful plates, comforting classics and contemporary favourites.', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85', 'Freshly plated pasta with herbs', 'Utensils', '#B58A4C', true),
 ('mexican', 4, '04 / BRIGHT & BOLD', 'Mexican', 'Fresh, punchy flavours and colourful combinations for adventurous appetites.', 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1000&q=85', 'Colourful tacos with fresh ingredients', 'Leaf', '#78905B', true)
on conflict (slug) do nothing;

-- Correct the original broken starter Chinese image on already-seeded websites,
-- but keep any image that an administrator has already customized.
update public.cuisine_sections
set image_url = 'https://images.unsplash.com/photo-1760699609029-01bcc566ab50?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000',
    image_alt = 'Chinese noodles with dumplings and fresh greens'
where slug = 'chinese'
  and (image_url = 'https://images.unsplash.com/photo-1563247118-4e4d5e4c9d8d?auto=format&fit=crop&w=1000&q=85' or image_url = '' or image_url is null);

-- updated_at triggers
 drop trigger if exists site_settings_set_updated_at on public.site_settings;
 create trigger site_settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();
 drop trigger if exists cuisine_sections_set_updated_at on public.cuisine_sections;
 create trigger cuisine_sections_set_updated_at before update on public.cuisine_sections for each row execute function public.set_updated_at();
 drop trigger if exists media_assets_set_updated_at on public.media_assets;
 create trigger media_assets_set_updated_at before update on public.media_assets for each row execute function public.set_updated_at();
 drop trigger if exists reviews_set_updated_at on public.reviews;
 create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();
 drop trigger if exists booking_requests_set_updated_at on public.booking_requests;
 create trigger booking_requests_set_updated_at before update on public.booking_requests for each row execute function public.set_updated_at();
 drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
 create trigger contact_messages_set_updated_at before update on public.contact_messages for each row execute function public.set_updated_at();

-- Turn on RLS for every exposed table.
alter table public.user_roles enable row level security;
alter table public.site_settings enable row level security;
alter table public.cuisine_sections enable row level security;
alter table public.media_assets enable row level security;
alter table public.reviews enable row level security;
alter table public.booking_requests enable row level security;
alter table public.contact_messages enable row level security;

-- Explicit grants: RLS policies alone do not remove pre-existing table privileges.
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.site_settings from anon, authenticated;
revoke all on table public.cuisine_sections from anon, authenticated;
revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.reviews from anon, authenticated;
revoke all on table public.booking_requests from anon, authenticated;
revoke all on table public.contact_messages from anon, authenticated;

grant select on table public.user_roles to authenticated;
grant select on table public.site_settings to anon, authenticated;
grant update on table public.site_settings to authenticated;
grant select on table public.cuisine_sections to anon, authenticated;
grant insert, update, delete on table public.cuisine_sections to authenticated;
grant select (id, title, alt_text, public_url, kind, status, created_at, updated_at) on table public.media_assets to anon;
grant select on table public.media_assets to authenticated;
grant insert, update, delete on table public.media_assets to authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert (display_name, rating, feeling, review_text, consent_publication, consent_version) on table public.reviews to anon, authenticated;
grant update, delete on table public.reviews to authenticated;
grant insert (customer_name, phone, email, party_size, requested_date, requested_time, message, privacy_consent) on table public.booking_requests to anon, authenticated;
grant select, update, delete on table public.booking_requests to authenticated;
grant insert (customer_name, email, phone, subject, message, privacy_consent) on table public.contact_messages to anon, authenticated;
grant select, update, delete on table public.contact_messages to authenticated;

-- Remove/recreate named policies so the master file remains safe to re-run.
drop policy if exists user_roles_read_self_or_admin on public.user_roles;
create policy user_roles_read_self_or_admin on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

 drop policy if exists site_settings_public_read on public.site_settings;
 create policy site_settings_public_read on public.site_settings for select to anon, authenticated using (id = 1);
 drop policy if exists site_settings_admin_update on public.site_settings;
 create policy site_settings_admin_update on public.site_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

 drop policy if exists cuisine_sections_public_read on public.cuisine_sections;
 create policy cuisine_sections_public_read on public.cuisine_sections for select to anon, authenticated using (is_active = true or (select public.is_admin()));
 drop policy if exists cuisine_sections_admin_insert on public.cuisine_sections;
 create policy cuisine_sections_admin_insert on public.cuisine_sections for insert to authenticated with check ((select public.is_admin()));
 drop policy if exists cuisine_sections_admin_update on public.cuisine_sections;
 create policy cuisine_sections_admin_update on public.cuisine_sections for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
 drop policy if exists cuisine_sections_admin_delete on public.cuisine_sections;
 create policy cuisine_sections_admin_delete on public.cuisine_sections for delete to authenticated using ((select public.is_admin()));

 drop policy if exists media_assets_public_read on public.media_assets;
 create policy media_assets_public_read on public.media_assets for select to anon, authenticated using (status = 'published' or (select public.is_admin()));
 drop policy if exists media_assets_admin_insert on public.media_assets;
 create policy media_assets_admin_insert on public.media_assets for insert to authenticated with check ((select public.is_admin()));
 drop policy if exists media_assets_admin_update on public.media_assets;
 create policy media_assets_admin_update on public.media_assets for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
 drop policy if exists media_assets_admin_delete on public.media_assets;
 create policy media_assets_admin_delete on public.media_assets for delete to authenticated using ((select public.is_admin()));

 drop policy if exists reviews_public_read_approved on public.reviews;
 create policy reviews_public_read_approved on public.reviews for select to anon, authenticated using ((status = 'approved' and consent_publication = true) or (select public.is_admin()));
 drop policy if exists reviews_public_insert_pending on public.reviews;
 create policy reviews_public_insert_pending on public.reviews for insert to anon, authenticated with check (
   status = 'pending' and highlight = false and consent_publication = true
   and rating between 1 and 5 and char_length(review_text) between 12 and 1000
   and created_at >= (pg_catalog.now() - interval '10 minutes')
 );
 drop policy if exists reviews_admin_update on public.reviews;
 create policy reviews_admin_update on public.reviews for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
 drop policy if exists reviews_admin_delete on public.reviews;
 create policy reviews_admin_delete on public.reviews for delete to authenticated using ((select public.is_admin()));

 drop policy if exists bookings_public_insert on public.booking_requests;
 create policy bookings_public_insert on public.booking_requests for insert to anon, authenticated with check (
   status = 'pending' and privacy_consent = true and party_size between 1 and 30
   and requested_date >= current_date and char_length(customer_name) between 2 and 100
   and char_length(phone) between 8 and 24 and phone ~ '^[+0-9 ()-]+$'
   and created_at >= (pg_catalog.now() - interval '10 minutes')
 );
 drop policy if exists bookings_admin_read on public.booking_requests;
 create policy bookings_admin_read on public.booking_requests for select to authenticated using ((select public.is_admin()));
 drop policy if exists bookings_admin_update on public.booking_requests;
 create policy bookings_admin_update on public.booking_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
 drop policy if exists bookings_admin_delete on public.booking_requests;
 create policy bookings_admin_delete on public.booking_requests for delete to authenticated using ((select public.is_admin()));

 drop policy if exists contacts_public_insert on public.contact_messages;
 create policy contacts_public_insert on public.contact_messages for insert to anon, authenticated with check (
   status = 'new' and privacy_consent = true and char_length(customer_name) between 2 and 100
   and char_length(email) between 3 and 254 and char_length(message) between 5 and 2000
   and created_at >= (pg_catalog.now() - interval '10 minutes')
 );
 drop policy if exists contacts_admin_read on public.contact_messages;
 create policy contacts_admin_read on public.contact_messages for select to authenticated using ((select public.is_admin()));
 drop policy if exists contacts_admin_update on public.contact_messages;
 create policy contacts_admin_update on public.contact_messages for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
 drop policy if exists contacts_admin_delete on public.contact_messages;
 create policy contacts_admin_delete on public.contact_messages for delete to authenticated using ((select public.is_admin()));

-- Admin-only upload/list/update/delete. Public display intentionally uses public image URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-media', 'website-media', true, 12582912, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml','image/x-icon','image/vnd.microsoft.icon'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists website_media_admin_select on storage.objects;
create policy website_media_admin_select on storage.objects for select to authenticated using (bucket_id = 'website-media' and (select public.is_admin()));
drop policy if exists website_media_admin_insert on storage.objects;
create policy website_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'website-media' and (select public.is_admin()));
drop policy if exists website_media_admin_update on storage.objects;
create policy website_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'website-media' and (select public.is_admin())) with check (bucket_id = 'website-media' and (select public.is_admin()));
drop policy if exists website_media_admin_delete on storage.objects;
create policy website_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'website-media' and (select public.is_admin()));


-- Enable Supabase Realtime for public website content. Safe to re-run if already enabled.
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null; when undefined_object then null; when insufficient_privilege then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.cuisine_sections;
exception when duplicate_object then null; when undefined_object then null; when insufficient_privilege then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null; when undefined_object then null; when insufficient_privilege then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.media_assets;
exception when duplicate_object then null; when undefined_object then null; when insufficient_privilege then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.contact_messages;
exception when duplicate_object then null; when undefined_object then null; when insufficient_privilege then null;
end $$;

commit;
