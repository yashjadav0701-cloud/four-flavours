# Four Flavours — Live Server edition

A premium, responsive restaurant marketing website built with **plain HTML, CSS and JavaScript**. It is designed to open directly in VS Code with Live Server. There is no React, Next.js, TypeScript, npm install, build step or local server code required.

## Core files

- `index.html` — public marketing website, customer reviews, tap-to-call restaurant contact and contact form.
- `css/styles.css` — responsive design system, motion, modals and mobile styles.
- `js/config.js` — your Supabase project URL and publishable key.
- `js/supabase-client.js` — creates the browser client with the official Supabase JS v2 CDN.
- `js/app.js` — website content, cuisine rendering, gallery, customer forms and live updates.
- `admin.html` — private admin sign-in and content studio. It is intentionally not in public navigation.
- `css/admin.css` and `js/admin.js` — responsive dashboard, edit tools, media uploads and moderation.
- `supabase/MASTER_MIGRATION.sql` — master PostgreSQL migration for Supabase.
- `docs/SUPABASE-SETUP-GUIDE.md` — first-time setup, master admin creation and testing.
- `docs/SECURITY-AND-LAUNCH-CHECKLIST.md` — security assumptions and launch steps.

## Deploy to Vercel through GitHub

1. Create a GitHub repository and upload the **contents** of this folder (so `index.html`, `admin.html`, `js/`, `css/`, `assets/`, and `vercel.json` are at the repository root).
2. In Vercel, choose **Add New → Project**, import that repository, and select **Other** as the framework if asked.
3. Keep the root directory as `./`. Leave the build command and output directory blank/default; this is a static HTML site and does not need `npm install` or a build.
4. Deploy. Open the generated domain and test the public website. Then test `/admin` or `/admin.html`.
5. In the same Supabase project configured in `js/config.js`, open **Authentication → URL Configuration**. Add your Vercel origin as the Site URL and add `https://YOUR-VERCEL-DOMAIN/admin?recovery=1` and `https://YOUR-VERCEL-DOMAIN/admin.html?recovery=1` to Redirect URLs (replace the placeholder with your real domain). Keep your local Live Server recovery URL too if you still use it.
6. After every GitHub push, Vercel will build a new deployment automatically. Check the deployment's build/output logs if a deployment fails.

Do not put a service-role/secret key into GitHub. The publishable key in `js/config.js` is intended for browser use; RLS and server-side role checks must enforce permissions.

## Run on your computer

1. Extract the ZIP into a normal folder.
2. Open that folder in VS Code.
3. Install the **Live Server** extension if you do not already have it.
4. Right-click `index.html` → **Open with Live Server**.
5. The public page opens at an address similar to `http://127.0.0.1:5500/index.html`.
6. The private sign-in page is `http://127.0.0.1:5500/admin.html`.

The public design can be previewed before Supabase is configured, using starter copy and illustrative food photography. Customer review and contact submissions, live content editing and uploads need an active Supabase project.

## Configure Supabase

Follow `docs/SUPABASE-SETUP-GUIDE.md`. In summary, create a Supabase project, run `supabase/MASTER_MIGRATION.sql` in Supabase SQL Editor, create the owner in Supabase Auth, assign their UUID to `public.user_roles` with role `admin`, and paste the project URL and publishable key into `js/config.js`.

**Never put a Supabase secret/service-role key in browser files.** The public key is designed to be exposed to the browser; the database's row-level security and admin-role check are what protect customer data and editing actions.

## What the studio can change

Restaurant name/tagline, announcement strip, logo, browser icon/favicon, hero/story content and images, contact information, hours, map URL, Google review URL, social links, theme colours, four image-container shape controls (hero, story, cuisine cards and gallery), SEO metadata, cuisine cards and photos, media library, guest review moderation/highlights, and contact-message statuses/private notes.

## A few important boundaries

- Table bookings are made by phone: customers use the public **Call the restaurant** action and the visible phone number configured in Admin → Website & branding.
- Customer reviews stay pending until an authorized admin approves them. Do not add fake testimonials or imply a Google rating that has not been verified.
- The gallery and logo assets must be licensed/owned. Starter external images are for design preview and should be replaced with the restaurant's own photography before launch.
- Contact enquiries are stored in Supabase. Email/SMS/WhatsApp alerts are not configured by this static starter; add a secure server-side notification workflow if the team needs automatic alerts.
- The public forms include validation and a honeypot, but production sites with high traffic should add stronger abuse controls such as CAPTCHA/Turnstile and server-side rate limits.
- The site uses the Supabase JS v2 CDN so it works without npm. A browser needs network access to load Supabase, web fonts and external starter photos.

## Production checks

See `docs/SECURITY-AND-LAUNCH-CHECKLIST.md` before pointing your domain at the site. Test it on actual mobile devices, not only browser emulation.

## Google reviews

See `docs/GOOGLE-REVIEWS-GUIDE.md` for the official Google review-link workflow, Places API (up to five reviews) and Business Profile API options. The static site does not scrape Google reviews.

### Admin branding controls

The Website & branding panel includes a live palette preview, exact HEX fields paired with the colour picker, and a desktop header-logo width slider. It controls accent/accent-dark, background/contrast, primary/secondary text, olive, gold, surface, and border colours; the values are stored in the existing `site_settings.theme` JSON field, so the updated palette does not require a database migration. The public header uses the bundled full Four Flavours logo on its own when no custom logo has been uploaded.

## Google review + image-frame data migration

Optional, data-only SQL: `supabase/migrations/20261030010000_google_reviews_image_shapes.sql`.
It fills the Google review destination only if the current value is blank and fills default image-frame keys in the existing `site_settings.theme` JSON without replacing non-empty saved selections. It makes no schema, permission, or function changes. Review the SQL and run it in Supabase SQL Editor only after confirming `public.site_settings` exists. Google Places API fetching separately requires the Edge Function deployment and server-side secrets described in `docs/GOOGLE-REVIEWS-GUIDE.md`.


## Google reviews free-usage protection

Follow `docs/GOOGLE-REVIEWS-FREE-TIER-SETUP.md`. Apply `supabase/migrations/20261030020000_google_reviews_daily_budget.sql` before deploying the Google reviews function. The function reserves at most 25 Google Places API calls per UTC day, makes no calls if the counter RPC is unavailable, and does not cache or persist Google review content. You must still create/restrict the Google Cloud API key and set the `GOOGLE_PLACES_API_KEY` and `ALLOWED_ORIGINS` Supabase secrets yourself.
