# Four Flavours — Google Reviews with a conservative free-usage cap

This project calls Google Places API (New) Place Details once when a visitor scrolls near the Reviews section. The browser never receives the Google API key. Google review text is not cached or written to Supabase because Places API content has strict caching/storage limits.

## Why the built-in limit is 25 requests/day

The server uses an atomic, database-backed counter with a fixed limit of 25 Google requests per UTC day. That means no more than 775 requests in a 31-day month are made through this function. The limit is intentionally conservative against Google's generally listed 1,000 monthly free events for the relevant Enterprise + Atmosphere SKU. Accounts eligible for India pricing may have a higher 7,000 monthly free usage cap for that SKU. Free caps are per SKU and monthly usage from other requests in the same billing scope can consume some of the allowance, so the cap reduces risk but cannot guarantee zero cost if the project is also used for other Google Places calls.

The counter is fail-closed: if the migration is missing or its RPC cannot be reached, the function does not call Google. Requests after the 25th successful budget reservation in a UTC day receive HTTP 429 until the next UTC day. Failed Google calls also consume one reservation; this is deliberate and conservative.

## 1. Google Cloud

1. Open https://console.cloud.google.com/ and create/select a dedicated project for Four Flavours reviews.
2. Link billing. Google Maps Platform requires a billing account even when requests fit within the free monthly usage cap.
3. Enable **Places API (New)**: https://console.cloud.google.com/apis/library/places.googleapis.com
4. Create a new API key. Give it a clear name such as `FourFlavours-Supabase-Places`.
5. In API restrictions, select **Restrict key** and allow only **Places API (New)**. Do not use HTTP-referrer restrictions on this key because the request originates from the Supabase server, not the customer's browser.
6. Do not use this key for other applications. Set up billing alerts and review actual Places API usage in Google Cloud regularly. Budget alerts are notifications, not hard spending caps.
7. Google pricing and policy are subject to change. Verify the SKU/free cap displayed for your own billing account before production use:
   - https://developers.google.com/maps/billing-and-pricing/pricing-india
   - https://developers.google.com/maps/documentation/places/web-service/policies

## 2. Apply the daily-budget migration first

Open Supabase SQL Editor for the existing Four Flavours project and run the entire file `supabase/migrations/20261030020000_google_reviews_daily_budget.sql` (also supplied separately as `Four-Flavours-Google-Reviews-Daily-Budget-Migration.sql`).

It creates one small usage-counter table and one security-definer RPC. It does not store review text, alter your existing content, change existing site settings, or create policies for browser access. The counter table is inaccessible directly to `anon`, `authenticated` and `service_role`; the function's server-side Supabase secret key is allowed to call the RPC.

## 3. Set the two Supabase Function secrets

Open Supabase Dashboard → Edge Functions → Secrets:
https://supabase.com/dashboard/project/hcvdmqxvgnandynshmgz/functions/secrets

Add:

- `GOOGLE_PLACES_API_KEY` = the restricted Google API key you just created
- `ALLOWED_ORIGINS` = the exact public site origin, e.g. `https://four-flavours.vercel.app`

Replace the example origin with the actual deployed Vercel/custom domain. Multiple origins can be comma-separated, but add only origins you control. Do not paste the Google key into `js/config.js`, Vercel browser-exposed variables, HTML, GitHub or chat.

The function reads Supabase's server-provided secret key internally to access its budget RPC. Do not manually expose or add a service-role/secret key to the website.

## 4. Deploy

From a terminal opened at the extracted project root:

```bash
npx supabase login
npx supabase link --project-ref hcvdmqxvgnandynshmgz
npx supabase functions deploy google-reviews --no-verify-jwt
```

If Supabase CLI configuration is missing from this ZIP, run `npx supabase init` once before linking. Do not overwrite `supabase/functions/google-reviews/index.ts` with an older copy.

The function is public because the website needs to request it without visitor login. CORS is not authentication; the database-backed daily request cap is the billable-request guard. The Google key remains server-side.

## 5. Verify it

1. Visit the website and scroll near the Reviews section.
2. Open browser developer tools → Network → filter `google-reviews`.
3. Expected response: `200` with fields such as `rating`, `userRatingCount`, `reviews` and `googleMapsUri`.
4. At the daily cap, expected response: `429`; if the usage table/function is unavailable, expected response: `503` and the Google API is not called.
5. In Supabase SQL Editor, optionally inspect only counter metadata:

```sql
select usage_date, request_count, updated_at
from public.google_reviews_daily_usage
order by usage_date desc
limit 7;
```

Google returns at most five reviews per Place Details response; they are sorted by relevance, not necessarily newest. The live content must retain required Google Maps and author attribution. See Google's current attribution/policy guide for the required logo and Terms/Privacy disclosures. Do not cache or permanently store Google review text.
