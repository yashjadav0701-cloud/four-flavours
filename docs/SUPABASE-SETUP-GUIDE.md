# Four Flavours — Supabase setup guide

This project uses static HTML/CSS/JS. Supabase provides the PostgreSQL database, authentication, file storage and optional Realtime updates. There is no Node.js setup step.

## 1. Create the project

1. Sign in at [Supabase](https://supabase.com/) and create a project for Four Flavours.
2. Choose a database password, keep it in a password manager, and choose a region suitable for your restaurant and customers (an India region is sensible when available to your project).
3. Wait until the project's database is ready.

## 2. Run the master migration

1. Open the project dashboard and go to **SQL Editor**.
2. Create a new query.
3. Open `supabase/MASTER_MIGRATION.sql` from this ZIP in VS Code and copy the complete file into the SQL Editor.
4. Run it once. It is designed to be re-runnable: the tables, triggers, policies, seed rows and storage bucket are guarded/replaced as appropriate.
5. Confirm it finishes without an error. The migration creates these tables:
   - `site_settings` — global content, brand, colour, contacts, links and SEO.
   - `cuisine_sections` — dynamic cuisine/story cards.
   - `media_assets` — searchable media library metadata.
   - `reviews` — customer comments and moderation status.
   - `booking_requests` — retained for backwards compatibility with older versions; the current public site books by phone and no longer creates online booking requests.
   - `contact_messages` — customer enquiry inbox and private notes.
   - `user_roles` — explicit administrator role assignment.
6. The migration creates the `website-media` Storage bucket for uploaded assets. Storage files are publicly readable by URL to display published images; file management is limited by admin policies.

If Realtime does not become enabled for all website tables, open **Database → Publications** and make sure `site_settings`, `cuisine_sections`, `reviews`, `media_assets` and `contact_messages` are included in `supabase_realtime`. The site still loads normally without Realtime, but a visitor may need to refresh to see a recent content edit.

## 3. Create the first admin user

1. Go to **Authentication → Users**.
2. Select **Add user** and create the owner/admin using an email and strong unique password.
3. Complete the email confirmation if your Auth settings require it.
4. Open **SQL Editor** and run the following query after replacing the email with the exact admin email:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('owner@example.com')
on conflict (user_id, role) do nothing;
```

5. Verify the assignment:

```sql
select u.email, r.role
from auth.users as u
join public.user_roles as r on r.user_id = u.id
where lower(u.email) = lower('owner@example.com');
```

If the first query inserts zero rows, check that the user exists in Authentication → Users and that the email is typed correctly. Do not make `user_roles` publicly writable and do not add an administrator role from browser code.

## 4. Add the Supabase URL and key to the website

1. In the Supabase dashboard, open **Project Settings → API Keys** (or the project's Connect/API details panel).
2. Copy the **Project URL**.
3. Copy the **publishable key**. A legacy `anon` key is also designed for public clients, but prefer the publishable key when the dashboard provides it.
4. Open `js/config.js` and update only these values:

```js
window.FF_CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabasePublishableKey: "YOUR_PUBLIC_PUBLISHABLE_KEY",
  storageBucket: "website-media"
});
```

Do **not** paste a secret key or `service_role` key here. Every browser visitor can inspect front-end files. The publishable/anon key is safe to expose only when the database and Storage policies are correctly configured; it is not an access-control substitute.

## 5. Run with VS Code Live Server

1. Open the extracted `four-flavours-live-server` folder in VS Code.
2. Install the **Live Server** extension if it is not already installed.
3. Right-click `index.html` and select **Open with Live Server**.
4. Use the URL shown by Live Server, normally `http://127.0.0.1:5500/index.html`.
5. Open the admin page directly at `/admin.html` in the same Live Server host and port.
6. Sign in with the owner/admin email and password from step 3. The code signs in with Supabase Auth, then checks that the authenticated UUID has the `admin` role. An account without the role is signed out.

If Live Server uses another port, that is fine for email/password sign-in. For password recovery or redirect-based auth later, add the exact local and deployed URLs under **Authentication → URL Configuration**.

## 6. Use the admin studio

The studio has no public navigation link. Go directly to `/admin.html`:

- **Website & branding:** edit global copy, logo, favicon, hero/story imagery, contact details, map directions, Google review URL, social links, colours and SEO metadata. Logo, favicon, hero and story images have direct upload controls that save to Supabase Storage and apply the URL automatically.
- **Cuisine cards:** add, edit, reorder, show/hide, and delete cuisine cards. URL slugs must be unique, lowercase and use letters, numbers or hyphens.
- **Images & media:** upload JPEG, PNG, WebP or AVIF images to the library. The browser resizes/compresses raster images, uploads them to Storage and writes a metadata record to `media_assets`. Use the Website & branding or cuisine-card file controls to upload and apply images directly. SVG and ICO are accepted for browser icons.
- **Guest reviews:** the queue displays pending reviews. Approve only a genuine, consented review; optional highlighting moves the review higher in the public list. Rejected/hidden reviews are not shown publicly.
- **Table booking:** the public site uses a click-to-call action rather than an online booking form. Configure the restaurant phone in Website & branding; customers call that number directly.
- **Contact messages:** manage customer questions, mark them as read/replied/closed or spam, and add private notes.

## 7. Test the public flows

1. In a private/incognito window, open the public site without signing in.
2. Submit a review with consent. It should be stored as `pending` and not appear publicly yet.
3. Sign in to `/admin.html`, approve that review, and refresh the public page. It should appear.
4. Click the public “Call the restaurant” action on a phone to confirm it opens the configured restaurant phone number.
5. Submit a contact message. Confirm that it appears in Contact Messages.
6. Upload an image and set its status to Published. Apply it to the hero or logo, save settings if you edited fields manually, and inspect the public website.
7. Sign out from the studio and verify that admin lists/actions are no longer available.

## 8. Common troubleshooting

**“Supabase is not connected.”** Check that `js/config.js` has the correct project URL and publishable/anon key, and reload the Live Server tab. Check browser DevTools Console for a blocked CDN or typo.

**“Invalid login credentials” / sign-in returns HTTP 400.** This is an authentication failure, not an admin-role failure: Supabase rejects the email/password before the site checks `public.user_roles`. First confirm `js/config.js` points to the intended project (the project reference in its URL must match the project where the account was created). In that exact project's **Authentication → Users**, confirm the administrator user exists and is not deleted/disabled. Then use **Forgot password?** on `admin.html` to request a reset email. If the account does not exist, create it in Authentication → Users and confirm its email as required. Do not run the admin-role SQL until the user can sign in successfully; role assignment cannot fix an invalid password.

**Password reset email is not delivered or its link is rejected.** In **Authentication → URL Configuration**, add the exact local redirect shown on the page when requesting recovery (normally `http://127.0.0.1:5500/admin.html?recovery=1`) and add the matching production admin URL when deployed. If there is no email, check spam and the project's email/SMTP delivery settings. Supabase may return a success response even when no account matches an email, to avoid exposing which accounts exist. Open a reset link in the same browser where you intend to set the new password, and request a fresh link if it expires.

**Sign-in succeeds but access is denied.** Only after successful Auth sign-in, the account UUID must exist in `public.user_roles` with role `admin`, and the migration/policies must be installed. Use the role-assignment query above and verify it with the SELECT query; do not try to solve `Invalid login credentials` by changing this table.

**Website form submission fails.** Verify the master migration finished, public insert grants/policies remain intact, the user's form meets validation rules, and the date is not in the past. The browser intentionally displays a general message rather than exposing the database's internal error to a customer; the real error appears in DevTools for troubleshooting.

**Image upload is rejected.** The user must have admin role, bucket name must remain `website-media`, file must be an accepted image format and at most 12 MB before browser compression, and the Storage policies from the master migration must exist.

**Changes do not show instantly.** Refresh the public page; then confirm Realtime publication membership and browser console/network errors.

## 9. Security and privacy reminders

- Only an authorized administrator can read the full booking/contact inbox. Public customers can insert a request but cannot select or update existing private requests through the client API.
- The review insert policy allows only pending reviews with publication consent; customers cannot approve or feature their own review.
- Never add a service-role key to `config.js`, HTML, JavaScript, a public Git repo or a Vercel client variable.
- Create only the owner's account; disable public account sign-up once the administrator account is created if you do not need customer accounts.
- Use a strong password and enable appropriate account security settings. Keep a private recovery owner account, document access handoff, and test backups.
- This static starter does not email/SMS the restaurant when a new request arrives. To notify staff, add an Edge Function/server-side email provider and protect its secrets server-side.
- The included client validation/honeypot is a baseline, not full bot protection. For public campaigns, use stronger server-side rate limiting and an anti-abuse service.
