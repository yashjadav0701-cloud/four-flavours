/*
  Four Flavours website configuration
  Paste the project's SUPABASE URL and publishable/anon key below.
  IMPORTANT: Never put a service_role/secret key in browser-side JavaScript.
*/
window.FF_CONFIG = Object.freeze({
  supabaseUrl: "https://hcvdmqxvgnandynshmgz.supabase.co",
  supabasePublishableKey: "sb_publishable_zK3QC1YGl6xC2Swho5cdpA_BUuvGvWV", // Supabase Dashboard -> Project Settings -> API Keys -> Publishable key
  storageBucket: "website-media",
  googleReviewsEnabled: true // Live Google reviews load after the google-reviews Edge Function and its server secrets are configured.
});
