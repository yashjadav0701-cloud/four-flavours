# Security & launch checklist

## Before publishing

- [ ] Run `supabase/MASTER_MIGRATION.sql` in the intended Supabase project and verify no migration errors.
- [ ] Create the owner in Supabase Auth and assign the account UUID the `admin` role through the SQL Editor.
- [ ] Confirm `public.user_roles` has no public insert/update/delete policy.
- [ ] Confirm RLS is enabled on every table exposed through Supabase Data API.
- [ ] Use only the public publishable/anon key in `js/config.js`. Never use a secret/service-role key in a static website.
- [ ] Test as an anonymous visitor: approved reviews can be read, but pending/rejected reviews and booking/contact records cannot be read.
- [ ] Test that a new review is stored as `pending`, and a customer cannot send its own `status` or `highlight` through the permitted insert fields.
- [ ] Test the dashboard as a signed-in non-admin: it must be rejected and signed out.
- [ ] Confirm public visitors cannot list private media records, browse the booking/contact inbox, or change any site settings.
- [ ] Upload a test image; confirm the correct file-size/MIME restrictions and that published public URLs render correctly.
- [ ] Verify map, phone, email, WhatsApp, socials, Google review link and actual opening hours.
- [ ] Replace starter photos with owned/licensed assets and enter verified business details.
- [ ] Test keyboard navigation, focus visibility, narrow mobile layout, tablet layout, slow connection and reduced-motion preference.
- [ ] Check that contact-form success messages are useful and that the public table-booking action calls the configured restaurant phone number rather than creating an online reservation.
- [ ] Decide whether to add server-side notification email, CAPTCHA/Turnstile and stronger rate-limiting before a large campaign.
- [ ] Configure the production URL in Supabase Auth URL Configuration if later workflows use redirects.
- [ ] Save a private copy of this project and maintain a recovery admin account and database backup plan.

## Explicit security model

The Supabase publishable key is visible to any website visitor. Security is enforced by PostgreSQL Row Level Security, explicit grants, the `public.is_admin()` function, Auth user identity, and Storage policies. `admin.html` is not linked in the public navigation, but an unlisted page is not a security boundary.

Supabase's website-media bucket is public so published images can be used by normal `<img>` elements. This means anyone possessing an exact image URL can read that file. Upload, update, listing through Storage API, and delete actions are restricted to admins. Do not upload private documents, customer photos without permission, or sensitive files into this bucket.

The customer forms include native validation and a honeypot field. Client-side controls can be bypassed, so they should be treated as usability/spam friction rather than hard security. For higher exposure, add server-side rate limiting and bot checks; do not put CAPTCHA secrets, SMTP keys or service-role credentials in client JavaScript.

## Validation status

The source is plain HTML/CSS/JavaScript and can be opened by Live Server without a package build. Local syntax and browser smoke checks should be rerun after changing code. Live database and production security behavior still require tests against the owner's actual Supabase project; this ZIP cannot assert the owner's project credentials or policies remotely.
