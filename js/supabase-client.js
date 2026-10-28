/* Browser-only Supabase client. Row Level Security is the security boundary. */
(() => {
  "use strict";
  const config = window.FF_CONFIG || {};
  const sdk = window.supabase;
  const url = String(config.supabaseUrl || "").trim().replace(/\/$/, "");
  const key = String(config.supabasePublishableKey || "").trim();
  const urlLooksValid = /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url) || /^https:\/\/[^\s/]+$/i.test(url);
  const keyLooksValid = key.length > 20 && !/service[_-]?role|secret/i.test(key.slice(0, 80));
  const ready = Boolean(sdk && typeof sdk.createClient === "function" && urlLooksValid && keyLooksValid);
  let client = null;
  if (ready) {
    try {
      client = sdk.createClient(url, key, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      });
    } catch (error) {
      console.error("Supabase client initialisation failed.", error);
    }
  }
  window.FF_BACKEND = Object.freeze({
    client,
    ready: Boolean(client),
    bucket: String(config.storageBucket || "website-media")
  });
})();
