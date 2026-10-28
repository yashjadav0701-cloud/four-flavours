// Optional server-side proxy for Google Places API (New) reviews.
// The Google API key stays in Supabase Function secrets, never in browser JS.
// This function does not persist Google's content; it passes through the current response.

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = configuredOrigins.length === 0
    ? "*"
    : (origin && configuredOrigins.includes(origin) ? origin : "null");
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
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }
  if (configuredOrigins.length > 0 && origin && !configuredOrigins.includes(origin)) {
    return jsonResponse({ error: "This website origin is not allowed." }, 403, origin);
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const placeId = Deno.env.get("GOOGLE_PLACES_PLACE_ID");
  if (!apiKey || !placeId) {
    return jsonResponse({ error: "Google Places is not configured on the server." }, 503, origin);
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
      // Avoid sending Google's internal response details or the API key to the browser.
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
