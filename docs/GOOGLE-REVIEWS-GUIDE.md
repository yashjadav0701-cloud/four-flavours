# Google Reviews — setup guide

For the conservative free-usage setup, follow `docs/GOOGLE-REVIEWS-FREE-TIER-SETUP.md` first. Apply the daily-budget migration before deploying this function. The function has a hard limit of 25 Google Places calls per UTC day, lazy-loads reviews only when the visitor approaches the reviews section, and fails closed if its usage guard is unavailable. Review content is deliberately not cached or persisted.

## Option A — quickest and recommended: link to the official Google review page

1. Sign in to the Google account that manages the restaurant's Google Business Profile.
2. Open the profile and choose **Ask for reviews** (wording may vary slightly), then copy the official review link.
3. Open `admin.html` → **Website & branding** → **Google review profile URL** and paste the link. Save settings.
4. Also fill **Google Business profile URL** under Social media links if you want the Google icon to appear in the social links.
5. On the public site, all prominent review-writing calls to action open this official Google review link in a new tab, where customers can post a review. “Read Google reviews” opens the business listing.

This does not import reviews into the website. It is the simplest way to keep customers on Google's official, up-to-date review page without needing an API key.

## Option B — automatically show some Google review snippets with Places API (New)

Places API (New) Place Details can return review data for a place, but the Place resource currently returns a maximum of five reviews, sorted by relevance—not the whole review history. Any review display must follow Google's attribution and Maps Platform terms. See the official [Place Details guide](https://developers.google.com/maps/documentation/places/web-service/place-details) and [Maps Platform policies](https://developers.google.com/maps/documentation/javascript/policies).

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and enable **Places API (New)**. Configure billing as required.
2. Obtain the restaurant's **Place ID** using Google's Place ID tools or Places API text search. Verify that the result is the exact Four Flavours listing.
3. Create an API key and restrict it to **Places API (New)**. This project deliberately calls Google from a server/Edge Function, so keep the key as a Supabase Function secret rather than using it in the browser. Add billing alerts and suitable API quotas. Do not put the Google key, service credentials or OAuth refresh tokens in `js/config.js`.
4. Request only the fields needed, for example `id,displayName,rating,userRatingCount,reviews,googleMapsUri`, with `X-Goog-FieldMask`. Keep the returned author's attribution and any required Google Maps branding/link visible in the UI.
5. This project includes an optional read-only Edge Function at `supabase/functions/google-reviews/index.ts`. From a terminal with the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and the project linked, deploy it:

   ```bash
   supabase functions deploy google-reviews --no-verify-jwt
   ```

   It is a public, read-only endpoint so website visitors can request the current place reviews. The updated function also enforces a database-backed maximum of 25 Google requests per UTC day; CORS is not authentication. Do not expose the Google API key in browser code.
6. The supplied review link resolves to Place ID `ChIJfbf-_13HXzkRG0PwRzehbcE`. The included Edge Function uses this Place ID by default; set `GOOGLE_PLACES_PLACE_ID` only if the official review link points to a different verified listing. Configure the Function secrets in the linked project (replace the API key and website origin with your real values; never share the key in chat):

   ```bash
   supabase secrets set GOOGLE_PLACES_API_KEY="YOUR_RESTRICTED_GOOGLE_API_KEY" ALLOWED_ORIGINS="https://four-flavours.vercel.app,http://127.0.0.1:5500,http://localhost:5500"
   ```

   The example includes the known `https://four-flavours.vercel.app` origin. Replace/add the exact production origin(s) (including `https://` and hostname) if your Vercel deployment or custom domain differs, plus any local Live Server origin you use. Restrict the Google key to Places API (New), set billing alerts and quotas, and verify the listing. `js/config.js` already has Google reviews enabled; once the function is deployed and the secret is set, the site requests it and shows the Google rating/review panel with source links and attribution. Without the secret/function configuration, the public page will continue to show direct links to Google but cannot fetch live snippets.
7. Test billing, quota, CORS, error handling and attribution before publishing. The function sends `Cache-Control: no-store` and does not write Google's review content to your database. Follow Google's current caching/storage and content-display rules; do not assume every returned review can be permanently copied into your own tables.

The included Google review cards link to each returned review's own Google Maps source and show author attribution. The panel says that results are ordered by relevance and explains that Google does not verify reviews; it also provides Google’s review-policy link. Before enabling Places API in a public launch, publish accessible Terms of Use and Privacy Policy pages that incorporate Google’s Terms of Service and Privacy Policy, and complete all attribution checks required by Google. See the official [Places API policies and attribution rules](https://developers.google.com/maps/documentation/places/web-service/policies).

This static starter displays first-party guest reviews from Supabase and can optionally display live Google Places results through the included server function. The Places endpoint currently returns at most five reviews, sorted by relevance; it is not a full review-history import.

## Option C — retrieve reviews for a verified business you manage

Google Business Profile API exposes a review-list method for a **verified** location and requires the appropriate Business Profile API access plus OAuth authorization for an account that manages the profile. This is usually the right route when you need to retrieve the business's own review list rather than the limited Places API selection. The official method is [accounts.locations.reviews.list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list).

1. Confirm that the Google Business Profile is verified and the owner account manages it.
2. Set up a Google Cloud project and request/enable Business Profile API access according to Google's current eligibility process.
3. Configure OAuth consent and the business-management scope required by the API. Use server-side OAuth; never place a client secret or refresh token in a static website.
4. Discover the account and location resource names, then call `accounts.locations.reviews.list` and follow the `nextPageToken` until no more pages remain.
5. Serve the resulting data from a protected server/Edge Function. Keep the review author/source and Google attribution clear, respect API policy limits, and never fabricate or alter a customer's words.

Google's review-list method states that the location must be verified and requires specific authorization; see the [official API reference](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list). API access and approval requirements can change, so check current eligibility in Google Cloud before investing in this integration.

## What to use on the Four Flavours site

- Keep **Option A** enabled for the customer-facing “Write a review” actions; they open the official Google review page.
- Use **Option B** for live Google review cards on the page. Follow `docs/GOOGLE-REVIEWS-FREE-TIER-SETUP.md`, apply the daily-budget migration, set the two Function secrets, and deploy the function.
- Use Option C only if you manage a verified profile and need the broader paginated review list; it requires separate Business Profile API access and OAuth authorization.
