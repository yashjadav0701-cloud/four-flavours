// Google Places API (New) reviews proxy for Four Flavours.
// Google review text is deliberately NOT cached or persisted: Places API policies restrict storage.
// A database-backed daily request counter prevents this public endpoint from making unlimited billable calls.

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const DAILY_GOOGLE_REQUEST_LIMIT = 25;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && configuredOrigins.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(payload: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      // Google Places content must not be cached or persisted by this integration.
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
    },
  });
}

type SupabaseServerCredential = { apiKey: string; authorization?: string };

function getSupabaseServerCredential(): SupabaseServerCredential | null {
  // Current non-JWT secret keys must be sent on apikey only. Do not put them in Authorization.
  const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretMap) {
    try {
      const parsed = JSON.parse(secretMap);
      if (parsed && typeof parsed.default === "string" && parsed.default.length > 0) {
        return { apiKey: parsed.default };
      }
    } catch {
      console.error("Supabase secret-key map could not be parsed.");
    }
  }

  // Backwards compatibility for projects that still inject the legacy JWT service-role key.
  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceRoleKey) {
    return { apiKey: legacyServiceRoleKey, authorization: `Bearer ${legacyServiceRoleKey}` };
  }
  return null;
}

async function consumeDailyBudget(
  supabaseUrl: string,
  credential: SupabaseServerCredential,
): Promise<{ allowed: boolean; unavailable: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/consume_google_reviews_daily_budget`, {
      method: "POST",
      headers: {
        "apikey": credential.apiKey,
        ...(credential.authorization ? { "Authorization": credential.authorization } : {}),
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
  } catch (error) {
    console.error("Google reviews budget service could not be reached.", error);
    return { allowed: false, unavailable: true };
  }

  if (!response.ok) {
    console.error("Google reviews budget check failed with status", response.status);
    return { allowed: false, unavailable: true };
  }

  try {
    const result: unknown = await response.json();
    if (result === true) return { allowed: true, unavailable: false };
    if (result === false) return { allowed: false, unavailable: false };
    console.error("Google reviews budget check returned an unexpected response.");
    return { allowed: false, unavailable: true };
  } catch {
    console.error("Google reviews budget response was not valid JSON.");
    return { allowed: false, unavailable: true };
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }
  if (configuredOrigins.length === 0) {
    return jsonResponse({ error: "The website origin allow-list is not configured." }, 503, origin);
  }
  if (!origin || !configuredOrigins.includes(origin)) {
    return jsonResponse({ error: "This website origin is not allowed." }, 403, origin);
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseCredential = getSupabaseServerCredential();
  // Default is the Place ID associated with the official Four Flavours review link supplied by the owner.
  const placeId = Deno.env.get("GOOGLE_PLACES_PLACE_ID") || "ChIJfbf-_13HXzkRG0PwRzehbcE";

  if (!apiKey) {
    return jsonResponse({ error: "Google Places is not configured on the server." }, 503, origin);
  }
  if (!supabaseUrl || !supabaseCredential) {
    return jsonResponse({ error: "The server-side usage guard is not configured. Google requests are paused to prevent unexpected charges." }, 503, origin);
  }

  // Fail closed: never call Google unless the database has atomically allowed this request.
  const budget = await consumeDailyBudget(supabaseUrl, supabaseCredential);
  if (budget.unavailable) {
    return jsonResponse({ error: "The Google review usage guard is unavailable. Requests are paused to prevent unexpected charges." }, 503, origin);
  }
  if (!budget.allowed) {
    return jsonResponse({ error: "The daily Google reviews refresh limit has been reached. Please try again tomorrow." }, 429, origin);
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  try {
    const googleResponse = await fetch(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews.text,reviews.originalText,reviews.rating,reviews.authorAttribution,reviews.publishTime,reviews.relativePublishTimeDescription,reviews.googleMapsUri,reviews.flagContentUri,googleMapsUri,attributions",
      },
      cache: "no-store",
    });
    if (!googleResponse.ok) {
      // Do not expose upstream response details or the API key to the browser.
      console.error("Google Places request failed with status", googleResponse.status);
      return jsonResponse({ error: "Google could not return place reviews. Check the Place ID, Places API access, billing and quota." }, 502, origin);
    }

    const result = await googleResponse.json();
    return jsonResponse({
      displayName: result.displayName || null,
      rating: result.rating ?? null,
      userRatingCount: result.userRatingCount ?? null,
      reviews: Array.isArray(result.reviews) ? result.reviews : [],
      googleMapsUri: result.googleMapsUri || null,
      attributions: Array.isArray(result.attributions) ? result.attributions : [],
    }, 200, origin);
  } catch (error) {
    console.error("Google Places proxy error", error);
    return jsonResponse({ error: "The Google reviews service is temporarily unavailable." }, 502, origin);
  }
});
