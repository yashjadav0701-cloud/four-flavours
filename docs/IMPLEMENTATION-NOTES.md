# Four Flavours website audit and implementation notes

This patch is based on the uploaded `four-flavours-live-server` ZIP. It has not been deployed to Vercel or run against the production Supabase project.

## Review integration

- Turns on the existing Google Reviews client switch. The site now invokes the existing `google-reviews` Supabase Edge Function when the backend is configured.
- Sets the supplied Google review link as the public write-review destination and uses the Place ID resolved from that link: `ChIJfbf-_13HXzkRG0PwRzehbcE`.
- Routes guest review call-to-action links to Google Maps rather than opening the legacy first-party review form.
- Keeps the website's existing admin-moderated review rows readable for compatibility; they are still distinct from Google reviews.
- Adds attribution/source/report links to Google review cards and includes a non-deceptive empty state when no written reviews are returned.
- Keeps the Google API key server-side in Supabase Function secrets. No key belongs in `js/config.js` or other browser code.
- The Edge Function requires an explicit `ALLOWED_ORIGINS` allow-list. Origins must match the exact deployed website origin(s), including `https://` and any `www` variant actually used.

Google Places API review output is limited to up to five reviews, ordered by relevance; it is not a full export of every review. Showing every review for a verified, managed Business Profile would require the appropriate Google Business Profile API access/OAuth rather than scraping Maps.

### Deployment configuration still required

In the Google Cloud project, enable Places API (New), ensure billing/quotas are configured, and create/restrict a server-side API key. In Supabase, deploy `supabase/functions/google-reviews/index.ts` as function `google-reviews` and set Function secrets:

- `GOOGLE_PLACES_API_KEY` — required, server-side only
- `GOOGLE_PLACES_PLACE_ID` — optional; current source defaults to the Place ID above
- `ALLOWED_ORIGINS` — required comma-separated exact origin allow-list, for example the production origin and a separate preview/local origin only if genuinely needed

Then verify a successful function invocation and a real browser page load. A browser CORS allow-list is not authentication or abuse prevention on its own; configure API quotas/restrictions and monitor the function.

## Admin image-frame controls

Added four frame selectors under Admin → Website & branding → Image frames: hero, story, cuisine cards, and gallery. Each has 14 options: classic rectangle, soft corners, rounded, pill, circle, arch, oval, organic, diamond, hexagon, cut corners, slant, leaf, and ticket. Preview tiles update immediately. Selections are saved in the existing `site_settings.theme` JSON, so this change does not require new columns or a schema migration.

## Visual and motion changes

- Elevated cuisine-card numbering and gallery labels above their images with explicit stacking layers.
- Added a slim scroll-progress indicator, animated Google review card entrance, refined hover transitions, and a `prefers-reduced-motion` fallback.
- Frame selections are applied through document-level data attributes; existing content and image URLs are not replaced.

## Database safety

Run `docs/READ_ONLY_DATABASE_AUDIT.sql` in Supabase SQL Editor and share its result grids before any database changes. It consists of SELECT statements only and does not mutate data.

## Free-usage protection

- Adds a database-backed cap of 25 outbound Google Places calls per UTC day, with fail-closed behavior if the budget guard is unavailable; no Google review content is cached or persisted.
- Loads the Google Reviews section only when the visitor approaches it, avoiding calls for visitors who never reach that section.
