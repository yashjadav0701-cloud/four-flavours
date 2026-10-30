/* Four Flavours private studio — no build step, plain JavaScript. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const backend = window.FF_BACKEND || { client: null, ready: false, bucket: "website-media" };
  const db = backend.client;
  const BUCKET = backend.bucket || "website-media";
  const $status = (id, message, kind = "") => {
    const node = $(id); if (!node) return;
    node.textContent = String(message || "");
    node.classList.toggle("is-error", kind === "error");
    node.classList.toggle("is-success", kind === "success");
    node.classList.toggle("is-warning", kind === "warning");
  };

  let currentUser = null;
  let isAdmin = false;
  let siteSettings = null;
  let cuisineRows = [];
  let mediaRows = [];
  let reviewRows = [];
  let messageRows = [];
  let confirmResolve = null;
  let activeTab = "overview";
  let adminRealtimeChannel = null;
  let adminRefreshTimer = null;

  function el(tag, className = "", text = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = String(text);
    return node;
  }

  function safeUrl(value, allowRelative = false) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (allowRelative && (/^\.\.?\//.test(raw) || raw.startsWith("/"))) return raw;
    try {
      const url = new URL(raw, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function showGlobal(message, kind = "") {
    $status("#globalStatus", message, kind);
  }

  function setHealth(id, textId, label, state) {
    const dot = $(id); const text = $(textId);
    if (dot) { dot.classList.toggle("is-ok", state === true); dot.classList.toggle("is-bad", state === false); }
    if (text) text.textContent = label;
  }

  function setConnection(label, state = "neutral") {
    const node = $(".connection-dot");
    if (node) { node.classList.toggle("is-online", state === "online"); node.classList.toggle("is-error", state === "error"); }
    const target = $("#connectionLabel"); if (target) target.textContent = label;
    const pill = $(".live-pill");
    const pillLabel = $("#liveModeLabel");
    if (pill) { pill.classList.toggle("is-connected", state === "online"); pill.classList.toggle("is-error", state === "error"); }
    if (pillLabel) pillLabel.textContent = state === "online" ? "LIVE · SUPABASE" : state === "error" ? "SETUP REQUIRED" : "CONNECTING…";
  }

  function showAuthPanel(mode = "login") {
    const login = $("#loginForm");
    const recovery = $("#recoveryForm");
    const reset = $("#passwordResetForm");
    if (login) login.hidden = mode !== "login";
    if (recovery) recovery.hidden = mode !== "recovery";
    if (reset) reset.hidden = mode !== "reset";
    const copy = {
      login: {
        eyebrow: "OWNER ACCESS · SECURE SIGN-IN",
        title: 'Welcome <em>back.</em>',
        intro: "Sign in with the administrator account created in Supabase. Access is checked against the server-side admin role and database policies."
      },
      recovery: {
        eyebrow: "ACCOUNT RECOVERY",
        title: 'Reset your <em>password.</em>',
        intro: "Enter the administrator email address. If the account exists, Supabase will send a secure, time-limited reset link."
      },
      reset: {
        eyebrow: "SECURE PASSWORD UPDATE",
        title: 'Choose a <em>new password.</em>',
        intro: "Choose a unique password of at least 10 characters. This updates the password for the Supabase account that opened this recovery link."
      }
    }[mode] || null;
    if (copy) {
      setText("#authEyebrow", copy.eyebrow);
      $("#loginTitle").innerHTML = copy.title;
      setText("#authIntro", copy.intro);
    }
  }

  function showPasswordReset() {
    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;
    showAuthPanel("reset");
    $status("#passwordResetStatus", "Recovery link accepted. Set your new password below.", "success");
  }

  function showLogin(message = "", kind = "") {
    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;
    showAuthPanel("login");
    $status("#loginStatus", message, kind);
  }

  function friendlySignInError(error) {
    const details = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    if (/invalid login credentials|invalid_credentials|invalid_grant/.test(details)) {
      return "Supabase rejected this email/password for the project configured in js/config.js. Confirm this email exists under Authentication → Users in that exact project, then use Forgot password? to set a new password. Admin-role assignment is checked only after sign-in succeeds.";
    }
    if (/email not confirmed|email_not_confirmed/.test(details)) {
      return "This account's email is not confirmed. Open the confirmation email from Supabase, then try signing in again. If it expired, resend confirmation from Supabase Authentication → Users.";
    }
    if (/too many requests|rate limit|over_request_rate_limit/.test(details)) {
      return "Too many sign-in attempts. Wait a few minutes before trying again, or use Forgot password? if you cannot remember the password.";
    }
    if (/user banned|user_banned/.test(details)) {
      return "Supabase has disabled this account. Check its status under Authentication → Users in the configured project.";
    }
    if (/failed to fetch|networkerror|fetch failed/.test(details)) {
      return "Could not reach Supabase. Check your internet connection, the project URL/key in js/config.js, and whether the project is available.";
    }
    return `Sign-in failed: ${String(error?.message || "Unexpected authentication error")}. Check the browser Console for technical details.`;
  }

  function showDashboard() {
    $("#loginView").hidden = true;
    $("#dashboardView").hidden = false;
    setText("#adminEmail", currentUser?.email || "Administrator");
    setConnection("Signed in as administrator", "online");
  }

  function setText(selector, text) { const node = $(selector); if (node) node.textContent = String(text ?? ""); }

  async function checkAdmin(user) {
    if (!db || !user?.id) return false;
    const { data, error } = await db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (error) {
      console.warn("Could not verify administrator role", error);
      return false;
    }
    return data?.role === "admin";
  }

  async function validateSessionAndEnter(user) {
    if (!user) { currentUser = null; isAdmin = false; showLogin(); return false; }
    currentUser = user;
    isAdmin = await checkAdmin(user);
    if (!isAdmin) {
      await db.auth.signOut();
      currentUser = null;
      showLogin("This account is signed in but does not have the admin role. Add its user UUID to public.user_roles through the Supabase SQL Editor.", "error");
      return false;
    }
    showDashboard();
    startAdminRealtime();
    await loadDashboardData();
    return true;
  }

  function wireLogin() {
    const configWarning = $("#configWarning");
    if (!backend.ready) {
      configWarning.hidden = false;
      setConnection("Supabase not configured", "error");
      setHealth("#healthAuth", "#healthAuthText", "Not connected", false);
      setHealth("#healthDatabase", "#healthDatabaseText", "Not connected", false);
      setHealth("#healthStorage", "#healthStorageText", "Not connected", false);
    }
    $("#loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!backend.ready || !db) {
        $status("#loginStatus", "Add your Supabase project URL and publishable key in js/config.js first.", "error"); return;
      }
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const button = $("#loginButton");
      button.disabled = true; button.textContent = "Checking access…";
      $status("#loginStatus", "");
      try {
        const { data: authData, error } = await db.auth.signInWithPassword({ email: String(data.email).trim(), password: String(data.password) });
        if (error) throw error;
        if (!(await validateSessionAndEnter(authData.user))) return;
        form.reset();
      } catch (error) {
        if (/invalid login credentials|invalid_credentials|invalid_grant|email not confirmed|email_not_confirmed/i.test(String(error?.message || error?.code || ""))) {
          console.info("Admin sign-in was rejected by Supabase Auth; the form displays recovery steps.");
        } else {
          console.warn("Admin sign-in request failed; see the on-page message for next steps.", error);
        }
        $status("#loginStatus", friendlySignInError(error), "error");
      } finally {
        button.disabled = false;
        button.innerHTML = 'Sign in securely <span>↗</span>';
      }
    });

    $("#forgotPasswordButton")?.addEventListener("click", () => {
      const currentEmail = $("#loginForm input[name=email]")?.value?.trim() || "";
      $("#recoveryEmail").value = currentEmail;
      $status("#loginStatus", "");
      $status("#recoveryStatus", "");
      showAuthPanel("recovery");
    });
    $("#backToLoginButton")?.addEventListener("click", () => showLogin());

    $("#recoveryForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!backend.ready || !db) {
        $status("#recoveryStatus", "Supabase is not configured. Check js/config.js first.", "error");
        return;
      }
      const email = String(new FormData(event.currentTarget).get("recoveryEmail") || "").trim();
      const button = $("#recoveryButton");
      button.disabled = true; button.textContent = "Sending reset link…";
      $status("#recoveryStatus", "");
      try {
        const redirectUrl = new URL(window.location.href);
        redirectUrl.search = "?recovery=1";
        redirectUrl.hash = "";
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.href });
        if (error) throw error;
        $status("#recoveryStatus", "If an account exists for this email, Supabase has sent a reset link. Check your inbox and spam folder. If no email arrives, verify the account in the configured project's Authentication → Users and check SMTP/email delivery settings.", "success");
      } catch (error) {
        console.error("Password recovery request failed", error);
        const message = String(error?.message || "");
        if (/redirect.*not allowed|not whitelisted|invalid redirect/i.test(message)) {
          $status("#recoveryStatus", `Supabase blocked the recovery redirect. In Authentication → URL Configuration, allow this exact URL: ${window.location.origin}${window.location.pathname}?recovery=1`, "error");
        } else {
          $status("#recoveryStatus", `Could not request a reset link: ${message || "Unexpected error"}. Check the configured project and its email settings.`, "error");
        }
      } finally {
        button.disabled = false; button.innerHTML = 'Send password reset link <span>↗</span>';
      }
    });

    $("#passwordResetForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!db) return;
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const password = String(data.newPassword || "");
      if (password.length < 10) {
        $status("#passwordResetStatus", "Use at least 10 characters for your new password.", "error"); return;
      }
      if (password !== String(data.confirmPassword || "")) {
        $status("#passwordResetStatus", "The passwords do not match. Please enter them again.", "error"); return;
      }
      const button = $("#savePasswordButton");
      button.disabled = true; button.textContent = "Updating password…";
      $status("#passwordResetStatus", "");
      try {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        await db.auth.signOut();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = ""; cleanUrl.hash = "";
        window.history.replaceState({}, document.title, cleanUrl.pathname);
        event.currentTarget.reset();
        showLogin("Password updated successfully. Sign in with your new password.", "success");
      } catch (error) {
        console.error("Password update failed", error);
        $status("#passwordResetStatus", `Could not update the password: ${String(error?.message || "Unexpected error")}. The recovery link may have expired; request a new one.`, "error");
      } finally {
        button.disabled = false; button.innerHTML = 'Save new password <span>↗</span>';
      }
    });

    // Supabase emits PASSWORD_RECOVERY after a valid reset link is consumed.
    db?.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) showPasswordReset();
    });
  }

  function setupNavigation() {
    $$("[data-tab]").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    $$('[data-jump]').forEach(button => button.addEventListener("click", () => switchTab(button.dataset.jump)));
    $("#mobileMenu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("is-open"));
    $("#refreshButton")?.addEventListener("click", loadDashboardData);
    $("#logoutButton")?.addEventListener("click", async () => {
      stopAdminRealtime();
      if (db) await db.auth.signOut();
      currentUser = null; isAdmin = false; showLogin("You have been signed out.", "success");
    });
  }

  function switchTab(tab) {
    const supported = ["overview", "settings", "cuisines", "media", "reviews", "messages"];
    if (!supported.includes(tab)) return;
    activeTab = tab;
    $$("[data-tab]").forEach(button => button.classList.toggle("is-active", button.dataset.tab === tab));
    $$(".tab-panel").forEach(panel => {
      const active = panel.id === `tab-${tab}`;
      panel.classList.toggle("is-active", active); panel.hidden = !active;
    });
    const labels = { overview: "Overview", settings: "Website & branding", cuisines: "Cuisine cards", media: "Images & media", reviews: "Guest reviews", messages: "Contact messages" };
    setText("#pageTitle", labels[tab] || "Overview");
    $("#sidebar")?.classList.remove("is-open");
    if (tab === "media") renderMedia();
    if (tab === "reviews") renderReviews();
    if (tab === "messages") renderMessages();
  }

  function confirmAction(title, message, buttonText = "Continue") {
    const dialog = $("#confirmDialog");
    if (!dialog) return Promise.resolve(window.confirm(message));
    setText("#confirmTitle", title); setText("#confirmMessage", message); setText("#confirmAccept", buttonText);
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "open");
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  function settleConfirm(value) {
    const dialog = $("#confirmDialog");
    if (dialog?.open) dialog.close(); else dialog?.removeAttribute("open");
    if (confirmResolve) confirmResolve(Boolean(value));
    confirmResolve = null;
  }

  function setupConfirm() {
    $("#confirmCancel")?.addEventListener("click", () => settleConfirm(false));
    $("#confirmAccept")?.addEventListener("click", () => settleConfirm(true));
    $("#confirmDialog")?.addEventListener("click", event => { if (event.target === event.currentTarget) settleConfirm(false); });
  }

  function startAdminRealtime() {
    if (!backend.ready || !db?.channel || adminRealtimeChannel || !isAdmin) return;
    try {
      const queueRefresh = () => {
        if (adminRefreshTimer) window.clearTimeout(adminRefreshTimer);
        adminRefreshTimer = window.setTimeout(() => {
          adminRefreshTimer = null;
          if (isAdmin) loadDashboardData();
        }, 500);
      };
      adminRealtimeChannel = db.channel("four-flavours-admin-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, queueRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "cuisine_sections" }, queueRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "media_assets" }, queueRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, queueRefresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, queueRefresh)
        .subscribe(status => {
          if (status === "CHANNEL_ERROR") console.info("Admin realtime is unavailable. Use Refresh to reload current Supabase data.");
        });
    } catch (error) {
      console.info("Admin realtime subscription skipped.", error?.message || error);
    }
  }

  function stopAdminRealtime() {
    if (adminRefreshTimer) { window.clearTimeout(adminRefreshTimer); adminRefreshTimer = null; }
    if (adminRealtimeChannel && db?.removeChannel) {
      try { db.removeChannel(adminRealtimeChannel); } catch (_) {}
    }
    adminRealtimeChannel = null;
  }

  async function loadDashboardData() {
    if (!backend.ready || !db || !isAdmin) return;
    showGlobal("Refreshing live data…");
    try {
      const results = await Promise.all([
        db.from("site_settings").select("*").eq("id", 1).single(),
        db.from("cuisine_sections").select("*").order("sort_order", { ascending: true }),
        db.from("media_assets").select("*").order("created_at", { ascending: false }),
        db.from("reviews").select("*").order("created_at", { ascending: false }).limit(300),
        db.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(300)
      ]);
      const [settingsRes, cuisinesRes, mediaRes, reviewsRes, messagesRes] = results;
      const errors = results.filter(result => result.error);
      if (settingsRes.error) setHealth("#healthDatabase", "#healthDatabaseText", "Query failed", false);
      else {
        siteSettings = settingsRes.data;
        applyAdminBranding(siteSettings);
        if ($("#settingsForm")?.dataset.dirty !== "true") fillSettingsForm();
        setHealth("#healthDatabase", "#healthDatabaseText", "Connected", true);
      }
      if (!cuisinesRes.error) cuisineRows = cuisinesRes.data || [];
      if (!mediaRes.error) { mediaRows = mediaRes.data || []; setHealth("#healthStorage", "#healthStorageText", "Metadata ready", true); }
      if (!reviewsRes.error) reviewRows = reviewsRes.data || [];
      if (!messagesRes.error) messageRows = messagesRes.data || [];
      renderOverview(); renderCuisines(); renderMedia(); renderReviews(); renderMessages();
      if (errors.length) {
        const missing = errors.map(result => result.error?.message || "query issue").join("; ");
        showGlobal("Some live dashboard data did not load. Re-run the latest master migration and check the administrator role and RLS policies.", "error");
        setConnection("Live database needs attention", "error");
        console.warn("Dashboard query issues", missing);
      } else {
        showGlobal("Live Supabase data refreshed successfully.", "success");
        setConnection("Live · Supabase connected", "online");
      }
      setHealth("#healthAuth", "#healthAuthText", "Admin verified", true);
    } catch (error) {
      console.error("Dashboard load failed", error);
      showGlobal("Could not load the dashboard. Check Supabase connectivity and RLS policies.", "error");
      setHealth("#healthDatabase", "#healthDatabaseText", "Unavailable", false);
    }
  }

  function renderOverview() {
    const pending = reviewRows.filter(item => item.status === "pending").length;
    const messages = messageRows.filter(item => ["new", "read"].includes(item.status)).length;
    setText("#metricReviews", pending); setText("#metricMessages", messages); setText("#metricMedia", mediaRows.length);
    const badge = $("#pendingBadge"); if (badge) { badge.textContent = String(pending); badge.hidden = pending < 1; }
  }

  const settingsTextFields = [
    "brand_name", "tagline", "announcement", "logo_url", "favicon_url", "brand_icon",
    "hero_eyebrow", "hero_title", "hero_description", "hero_image_url", "hero_image_alt", "hero_cta_label",
    "story_eyebrow", "story_title", "story_body", "story_image_url", "review_title", "review_subtitle",
    "gallery_title", "gallery_subtitle", "visit_title", "visit_subtitle", "address", "phone", "email",
    "opening_hours", "map_url", "google_review_url", "meta_title", "meta_description"
  ];

  function setDynamicFavicon(rawUrl) {
    const url = safeUrl(rawUrl, true);
    if (!url) return;
    let icon = $("link[rel='icon']");
    if (!icon) { icon = el("link"); icon.rel = "icon"; document.head.append(icon); }
    icon.href = url;
  }

  function applyAdminBranding(source = siteSettings) {
    if (!source) return;
    setDynamicFavicon(source.favicon_url || "");
    const logoUrl = safeUrl(source.logo_url, true) || "assets/images/four-flavours-logo.png";
    [".login-brand", ".sidebar-brand"].forEach(selector => {
      const brand = $(selector);
      if (!brand) return;
      let image = $(".admin-brand-image", brand);
      if (!image) {
        image = el("img", "admin-brand-image");
        brand.replaceChildren(image);
      }
      image.alt = `${source.brand_name || "Four Flavours"} logo`;
      image.onerror = () => { image.onerror = null; image.src = "assets/images/four-flavours-logo.png"; };
      if (image.getAttribute("src") !== logoUrl) image.src = logoUrl;
    });
  }

  function updateImagePreview(fieldName, rawUrl) {
    const wrap = $(`[data-image-preview="${fieldName}"]`);
    const image = wrap?.querySelector("img");
    const url = safeUrl(rawUrl, true);
    if (!wrap || !image) return;
    if (!url) { wrap.hidden = true; image.removeAttribute("src"); return; }
    image.onerror = () => { image.onerror = null; wrap.hidden = true; };
    image.onload = () => { wrap.hidden = false; };
    image.src = url;
  }

  function updateCuisineImagePreview(rawUrl) {
    const wrap = $("#cuisineImagePreviewWrap");
    const image = $("#cuisineImagePreview");
    const url = safeUrl(rawUrl, true);
    if (!wrap || !image) return;
    if (!url) { wrap.hidden = true; image.removeAttribute("src"); return; }
    image.onerror = () => { image.onerror = null; wrap.hidden = true; };
    image.onload = () => { wrap.hidden = false; };
    image.src = url;
  }

  function fillSettingsForm() {
    if (!siteSettings) return;
    const form = $("#settingsForm"); if (!form) return;
    settingsTextFields.forEach(name => { const field = form.elements.namedItem(name); if (field) field.value = siteSettings[name] ?? ""; });
    // Use the bundled logo as the initial selectable logo when no custom asset is configured.
    const logoField = form.elements.namedItem("logo_url");
    if (logoField && !String(siteSettings.logo_url || "").trim()) logoField.value = "assets/images/four-flavours-logo.png";
    const faviconField = form.elements.namedItem("favicon_url");
    if (faviconField && !String(siteSettings.favicon_url || "").trim()) faviconField.value = "assets/icons/four-flavours-icon.png";
    ["logo_url", "favicon_url", "hero_image_url", "story_image_url"].forEach(name => updateImagePreview(name, name === "logo_url" ? (siteSettings.logo_url || "assets/images/four-flavours-logo.png") : (siteSettings[name] || (name === "favicon_url" ? "assets/icons/four-flavours-icon.png" : ""))));
    applyAdminBranding(siteSettings);
    const social = siteSettings.social_links || {};
    ["instagram", "facebook", "whatsapp", "youtube", "googleBusiness"].forEach(key => {
      const field = form.elements.namedItem(`social_${key}`); if (field) field.value = social[key] || "";
    });
    const theme = siteSettings.theme || {};
    const shapeDefaults = { hero: "arch", story: "classic", cuisine: "arch", gallery: "rounded" };
    Object.entries(shapeDefaults).forEach(([area, fallback]) => {
      const field = form.elements.namedItem(`theme_${area}_shape`);
      if (field) field.value = ["classic", "soft", "rounded", "pill", "circle", "arch", "oval", "organic", "diamond", "hexagon", "cut-corners", "slant", "leaf", "ticket"].includes(theme[`${area}_shape`]) ? theme[`${area}_shape`] : fallback;
    });
    updateShapePreviews();
    const colourDefaults = {
      accent: "#B64F38", accent_dark: "#8E3828", paper: "#F6F0E6", paper_deep: "#EEE5D8",
      ink: "#20211D", ink_soft: "#52534B", olive: "#53664E", gold: "#D4A74F", surface: "#FFFDF8", line: "#D6CFC1"
    };
    Object.entries(colourDefaults).forEach(([key, fallback]) => {
      const value = /^#[\da-f]{6}$/i.test(theme[key] || "") ? theme[key].toUpperCase() : fallback;
      const field = form.elements.namedItem(`theme_${key}`); if (field) field.value = value;
      const hexField = form.elements.namedItem(`theme_${key}_hex`); if (hexField) { hexField.value = value; hexField.setCustomValidity(""); hexField.removeAttribute("aria-invalid"); }
    });
    const logoWidth = Number(theme.logo_width);
    const widthField = form.elements.namedItem("theme_logo_width");
    if (widthField) widthField.value = String(Number.isFinite(logoWidth) && logoWidth >= 200 && logoWidth <= 360 ? logoWidth : 280);

    const marqueeEnabledField = form.elements.namedItem("theme_marquee_enabled");
    if (marqueeEnabledField) marqueeEnabledField.checked = theme.marquee_enabled !== false;

    const savedMarqueeSpeed = Number(theme.marquee_speed ?? 34);
    const marqueeSpeed = Number.isFinite(savedMarqueeSpeed)
      ? Math.min(60, Math.max(10, savedMarqueeSpeed))
      : 34;

    const marqueeSpeedField = form.elements.namedItem("theme_marquee_speed");
    if (marqueeSpeedField) marqueeSpeedField.value = String(marqueeSpeed);

    const marqueeSpeedOutput = $("#marqueeSpeedValue");
    if (marqueeSpeedOutput) {
      marqueeSpeedOutput.textContent = `${marqueeSpeed} seconds per loop · ${marqueeSpeed <= 20 ? "Fast" : marqueeSpeed <= 40 ? "Normal" : "Slow"}`;
    }

    updateThemePreview();
  }

  function updateShapePreviews() {
    const form = $("#settingsForm");
    if (!form) return;
    ["hero", "story", "cuisine", "gallery"].forEach(area => {
      const selected = form.elements.namedItem(`theme_${area}_shape`)?.value || ({ hero: "arch", story: "classic", cuisine: "arch", gallery: "rounded" })[area];
      const preview = $(`[data-shape-preview="${area}"]`);
      if (preview) preview.dataset.shape = selected;
    });
  }

  const DEFAULT_THEME_COLORS = {
    theme_accent: "#B64F38", theme_accent_dark: "#8E3828", theme_paper: "#F6F0E6", theme_paper_deep: "#EEE5D8",
    theme_ink: "#20211D", theme_ink_soft: "#52534B", theme_olive: "#53664E", theme_gold: "#D4A74F", theme_surface: "#FFFDF8", theme_line: "#D6CFC1"
  };

  function updateThemePreview() {
    const form = $("#settingsForm");
    const preview = $("#themePreview");
    if (!form || !preview) return;
    Object.keys(DEFAULT_THEME_COLORS).forEach(name => {
      const picker = form.elements.namedItem(name);
      const value = /^#[\da-f]{6}$/i.test(picker?.value || "") ? picker.value : DEFAULT_THEME_COLORS[name];
      preview.style.setProperty(`--preview-${name.replace("theme_", "").replaceAll("_", "-")}`, value);
      const swatch = preview.querySelector(`[data-swatch="${name}"]`);
      if (swatch) { swatch.style.backgroundColor = value; swatch.setAttribute("aria-label", `${name.replace("theme_", "").replaceAll("_", " ")}: ${value}`); }
    });
    const width = Number(form.elements.namedItem("theme_logo_width")?.value || 280);
    const output = $("#logoWidthValue"); if (output) output.textContent = `${width} px`;
  }

  function syncColourControls() {
    const form = $("#settingsForm");
    if (!form) return;
    $$('input[data-color-picker]', form).forEach(picker => {
      const hex = form.elements.namedItem(`${picker.name}_hex`);
      picker.addEventListener("input", () => {
        if (hex) { hex.value = picker.value.toUpperCase(); hex.setCustomValidity(""); hex.removeAttribute("aria-invalid"); }
        updateThemePreview();
      });
      picker.addEventListener("change", updateThemePreview);
    });
    $$('input[data-hex-for]', form).forEach(hex => {
      const picker = form.elements.namedItem(hex.dataset.hexFor);
      const sync = (commit = false) => {
        const raw = hex.value.trim();
        const normalized = raw.startsWith("#") ? raw : `#${raw}`;
        const valid = /^#[\da-f]{6}$/i.test(normalized);
        if (valid) {
          if (commit) hex.value = normalized.toUpperCase();
          if (picker) picker.value = normalized.toLowerCase();
          hex.setCustomValidity(""); hex.removeAttribute("aria-invalid");
          updateThemePreview();
        } else {
          hex.setCustomValidity("Enter a six-digit HEX colour, such as #B64F38.");
          hex.setAttribute("aria-invalid", "true");
        }
      };
      hex.addEventListener("input", () => sync(false));
      hex.addEventListener("change", () => sync(true));
      hex.addEventListener("blur", () => sync(true));
    });
    $("#theme_logo_width")?.addEventListener("input", updateThemePreview);

    $("#theme_marquee_speed")?.addEventListener("input", event => {
      const value = Number(event.currentTarget.value);
      const output = $("#marqueeSpeedValue");

      if (output) {
        output.textContent = `${value} seconds per loop · ${value <= 20 ? "Fast" : value <= 40 ? "Normal" : "Slow"}`;
      }
    });

    $("#resetThemeColors")?.addEventListener("click", () => {
      Object.entries(DEFAULT_THEME_COLORS).forEach(([name, value]) => {
        const picker = form.elements.namedItem(name); const hex = form.elements.namedItem(`${name}_hex`);
        if (picker) picker.value = value;
        if (hex) { hex.value = value; hex.setCustomValidity(""); hex.removeAttribute("aria-invalid"); }
      });
      const width = form.elements.namedItem("theme_logo_width"); if (width) width.value = "280";
      form.dataset.dirty = "true";
      updateThemePreview();
    });
    updateThemePreview();
  }

  async function saveSettingsFromForm(event) {
    event.preventDefault(); if (!db || !isAdmin) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {};
    settingsTextFields.forEach(name => { payload[name] = String(data[name] ?? "").trim(); });
    payload.social_links = {
      instagram: String(data.social_instagram || "").trim(), facebook: String(data.social_facebook || "").trim(),
      whatsapp: String(data.social_whatsapp || "").trim(), youtube: String(data.social_youtube || "").trim(),
      googleBusiness: String(data.social_googleBusiness || "").trim()
    };
    payload.theme = {
      ...(siteSettings?.theme && typeof siteSettings.theme === "object" ? siteSettings.theme : {}),
      accent: data.theme_accent || "#B64F38", accent_dark: data.theme_accent_dark || "#8E3828",
      paper: data.theme_paper || "#F6F0E6", paper_deep: data.theme_paper_deep || "#EEE5D8",
      ink: data.theme_ink || "#20211D", ink_soft: data.theme_ink_soft || "#52534B", olive: data.theme_olive || "#53664E",
      gold: data.theme_gold || "#D4A74F",
      surface: data.theme_surface || "#FFFDF8",
      line: data.theme_line || "#D6CFC1",
      logo_width: Math.min(360, Math.max(200, Number(data.theme_logo_width) || 280)),
      marquee_enabled: data.theme_marquee_enabled === "on",
      marquee_speed: Math.min(60,Math.max(10, Number(data.theme_marquee_speed) || 34)),
      hero_shape: data.theme_hero_shape || "arch", story_shape: data.theme_story_shape || "classic",
      cuisine_shape: data.theme_cuisine_shape || "arch", gallery_shape: data.theme_gallery_shape || "rounded"
    };
    const status = $("#settingsStatus"); if (status) status.textContent = "Saving…";
    const button = form.querySelector("button[type='submit']"); if (button) button.disabled = true;
    try {
      const { data: saved, error } = await db.from("site_settings").update(payload).eq("id", 1).select("*").single();
      if (error) throw error;
      siteSettings = saved;
      form.dataset.dirty = "false";
      fillSettingsForm();
      $status("#settingsStatus", "Saved to Supabase. The public site will refresh its content on active sessions when Realtime is enabled.", "success");
      showGlobal("Website settings saved.", "success");
    } catch (error) {
      console.error("Settings save failed", error);
      $status("#settingsStatus", "Settings could not be saved. Check the form values and admin RLS policies.", "error");
    } finally { if (button) button.disabled = false; }
  }

  function renderCuisines() {
    const list = $("#cuisineList"); if (!list) return;
    list.replaceChildren();
    if (!cuisineRows.length) { list.append(emptyState("No cuisine cards found", "Apply the master migration or add a cuisine card to begin.")); return; }
    cuisineRows.forEach(item => {
      const card = el("article", "cuisine-admin-card");
      const image = el("img"); image.loading = "lazy"; image.alt = item.image_alt || item.title || "Cuisine image";
      image.onerror = () => {
        image.onerror = null;
        if (/^chinese$/i.test(String(item.slug || ""))) {
          image.onerror = () => { image.onerror = null; image.removeAttribute("src"); image.style.background = "#d8c9b6"; };
          image.src = "https://images.unsplash.com/photo-1761125066136-f657176f7525?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000";
        } else { image.removeAttribute("src"); image.style.background = "#d8c9b6"; }
      };
      const url = safeUrl(item.image_url, true); if (url) image.src = url;
      const body = el("div", "cuisine-admin-card__body");
      body.append(el("p", "kicker", `${item.eyebrow || "CUISINE CARD"} · ${String(item.slug || "").toUpperCase()}`));
      body.append(el("h3", "", item.title)); body.append(el("p", "", item.description));
      const row = el("div", "card-meta-row");
      row.append(statusPill(item.is_active ? "Visible on site" : "Hidden", item.is_active ? "green" : "gold"));
      const edit = el("button", "small-action", "Edit card"); edit.type = "button"; edit.addEventListener("click", () => openCuisineEditor(item)); row.append(edit);
      body.append(row); card.append(image, body); list.append(card);
    });
  }

  function openCuisineEditor(item = null) {
    const wrap = $("#cuisineEditorWrap"); const form = $("#cuisineForm"); if (!wrap || !form) return;
    form.reset();
    const keys = ["id", "slug", "sort_order", "eyebrow", "title", "description", "image_url", "image_alt", "accent_color", "icon_name"];
    keys.forEach(key => { const field = form.elements.namedItem(key); if (field) field.value = item?.[key] ?? (key === "accent_color" ? "#C66A3D" : key === "sort_order" ? String(cuisineRows.length + 1) : ""); });
    form.elements.namedItem("is_active").checked = item ? item.is_active !== false : true;
    updateCuisineImagePreview(item?.image_url || "");
    $status("#cuisineImageUploadStatus", "Upload an image from your device or paste an image URL above.");
    setText("#cuisineEditorTitle", item ? `Edit ${item.title}` : "New cuisine card");
    $("#deleteCuisineButton").hidden = !item;
    $status("#cuisineStatus", "");
    wrap.hidden = false; wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveCuisine(event) {
    event.preventDefault(); if (!db || !isAdmin) return;
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const id = String(data.id || "").trim();
    const payload = {
      slug: String(data.slug || "").trim().toLowerCase(), sort_order: Number(data.sort_order || 0), icon_name: String(data.icon_name || "sparkles").trim().slice(0, 60),
      eyebrow: String(data.eyebrow || "").trim(), title: String(data.title || "").trim(),
      description: String(data.description || "").trim(), image_url: String(data.image_url || "").trim(),
      image_alt: String(data.image_alt || "").trim(), accent_color: data.accent_color || "#C66A3D",
      is_active: form.elements.namedItem("is_active").checked
    };
    if (!/^[a-z0-9-]{2,50}$/.test(payload.slug)) { $status("#cuisineStatus", "Use a lowercase URL slug with letters, numbers and hyphens.", "error"); return; }
    $status("#cuisineStatus", "Saving…");
    try {
      const result = id ? await db.from("cuisine_sections").update(payload).eq("id", id) : await db.from("cuisine_sections").insert(payload);
      if (result.error) throw result.error;
      $("#cuisineEditorWrap").hidden = true;
      showGlobal("Cuisine card saved.", "success"); await loadDashboardData();
    } catch (error) {
      console.error("Cuisine save failed", error);
      $status("#cuisineStatus", "Could not save this card. Check for a duplicate slug and verify database policies.", "error");
    }
  }

  async function deleteCuisine() {
    const id = $("#cuisineForm [name='id']")?.value;
    if (!id || !db || !isAdmin) return;
    const item = cuisineRows.find(row => row.id === id);
    if (!(await confirmAction("Delete cuisine card?", `“${item?.title || "This card"}” will be removed from the website.`, "Delete card"))) return;
    try {
      const { error } = await db.from("cuisine_sections").delete().eq("id", id); if (error) throw error;
      $("#cuisineEditorWrap").hidden = true; showGlobal("Cuisine card deleted.", "success"); await loadDashboardData();
    } catch (error) { console.error(error); $status("#cuisineStatus", "Could not delete this card.", "error"); }
  }

  function emptyState(title, body) {
    const node = el("div", "empty-state"); node.append(el("strong", "", title), el("span", "", body)); return node;
  }

  function statusPill(text, tone = "") {
    const cls = tone ? `status-pill status-pill--${tone}` : "status-pill";
    return el("span", cls, text);
  }

  async function compressImage(file) {
    const extension = String(file.name || "").toLowerCase().split(".").pop();
    const inferredType = ({ svg: "image/svg+xml", ico: "image/x-icon" })[extension] || file.type;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(inferredType)) throw new Error("Choose a JPG, PNG, WebP, AVIF, SVG or ICO image.");
    if (file.size > 12 * 1024 * 1024) throw new Error("Images must be 12 MB or smaller before upload.");
    if (["image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"].includes(inferredType)) {
      return file.type === inferredType ? file : new File([file], file.name, { type: inferredType, lastModified: file.lastModified });
    }
    if (!("createImageBitmap" in window)) return file;
    const bitmap = await createImageBitmap(file);
    const maxDimension = 2400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) { bitmap.close?.(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob) return file;
    // Avoid changing format if doing so makes the image larger and original is already web-safe.
    if (blob.size >= file.size && file.type !== "image/avif") return file;
    const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70) || "image";
    return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
  }

  async function uploadAssetFile(file, options = {}) {
    if (!db || !isAdmin || !currentUser) throw new Error("Sign in as an authorized administrator before uploading images.");
    const prepared = await compressImage(file);
    const safeName = prepared.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90) || "image.webp";
    const storagePath = `${currentUser.id}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`;
    let createdAsset = null;
    try {
      const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, prepared, {
        cacheControl: "3600", upsert: false, contentType: prepared.type || file.type || "application/octet-stream"
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
      if (!publicData?.publicUrl) throw new Error("Supabase did not return a public image URL.");
      const payload = {
        title: String(options.title || prepared.name).trim().slice(0, 160),
        alt_text: String(options.altText || "").trim().slice(0, 240),
        public_url: publicData.publicUrl,
        storage_path: storagePath,
        kind: String(options.kind || "other"),
        status: String(options.status || "published"),
        licence_notes: String(options.licenceNotes || "Uploaded by an authorized admin").trim().slice(0, 1000),
        created_by: currentUser.id
      };
      const { data: asset, error: insertError } = await db.from("media_assets").insert(payload).select("*").single();
      if (insertError) throw insertError;
      createdAsset = asset;
      mediaRows = [asset, ...mediaRows.filter(row => row.id !== asset.id)];
      renderMedia();
      setHealth("#healthStorage", "#healthStorageText", "Connected", true);
      return asset;
    } catch (error) {
      if (!createdAsset && storagePath) {
        const { error: cleanupError } = await db.storage.from(BUCKET).remove([storagePath]);
        if (cleanupError) console.warn("Upload cleanup failed", cleanupError);
      }
      throw error;
    }
  }

  async function uploadInlineSettingImage(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const fieldName = input.dataset.uploadSetting;
    if (!file || !fieldName) return;
    const status = $(`[data-upload-status-for="${fieldName}"]`);
    const field = $(`#settingsForm [name="${fieldName}"]`);
    if (!db || !isAdmin || !currentUser || !field) {
      if (status) status.textContent = "Connect Supabase and sign in as an admin before uploading.";
      input.value = ""; return;
    }
    input.disabled = true;
    if (status) status.textContent = "Uploading image to Supabase…";
    try {
      const asset = await uploadAssetFile(file, {
        kind: input.dataset.mediaKind || "other",
        title: input.dataset.mediaTitle || file.name,
        altText: input.dataset.mediaAlt || "",
        status: "published"
      });
      const { data: saved, error } = await db.from("site_settings").update({ [fieldName]: asset.public_url }).eq("id", 1).select("*").single();
      if (error) throw error;
      siteSettings = { ...(siteSettings || {}), ...saved };
      field.value = asset.public_url;
      updateImagePreview(fieldName, asset.public_url);
      applyAdminBranding(siteSettings);
      if (status) status.textContent = "Uploaded and applied to the live website. Other text changes still need Save website settings.";
      showGlobal(`${asset.title} uploaded and applied successfully.`, "success");
    } catch (error) {
      console.error("Inline image upload failed", error);
      if (status) status.textContent = error?.message || "Upload failed. Check the Storage bucket and admin policies.";
      showGlobal("Image upload failed. Check the Storage bucket, MIME types and admin policies.", "error");
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }

  async function uploadCuisineImage(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const status = $("#cuisineImageUploadStatus");
    if (!db || !isAdmin || !currentUser) {
      if (status) status.textContent = "Connect Supabase and sign in as an admin before uploading.";
      input.value = ""; return;
    }
    input.disabled = true;
    if (status) status.textContent = "Uploading cuisine photo…";
    try {
      const title = `${String($("#cuisineForm [name='title']")?.value || "Cuisine").trim()} cuisine image`;
      const asset = await uploadAssetFile(file, {
        kind: "cuisine", title, altText: `${String($("#cuisineForm [name='title']")?.value || "Cuisine").trim()} food photograph`, status: "published"
      });
      const field = $("#cuisineImageUrl");
      if (field) field.value = asset.public_url;
      updateCuisineImagePreview(asset.public_url);
      if (status) status.textContent = "Image uploaded. Save the cuisine card to publish it on the homepage.";
      showGlobal("Cuisine image uploaded. Save the cuisine card to publish the change.", "success");
    } catch (error) {
      console.error("Cuisine image upload failed", error);
      if (status) status.textContent = error?.message || "Could not upload the cuisine image.";
      showGlobal("Cuisine image upload failed. Check Storage settings.", "error");
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }

  function renderMedia() {
    const grid = $("#mediaGrid"); if (!grid) return;
    const filter = $("#mediaFilter")?.value || "all";
    const rows = mediaRows.filter(item => {
      if (["published", "draft"].includes(filter)) return item.status === filter;
      if (["logo", "gallery", "favicon"].includes(filter)) return item.kind === filter;
      return true;
    });
    grid.replaceChildren();
    if (!rows.length) { grid.append(emptyState("Your media library is waiting", "Upload a hero photo, your restaurant logo, a favicon or gallery images above.")); return; }
    rows.forEach(asset => {
      const card = el("article", "media-card");
      const visual = el("div", "media-card__image");
      const image = el("img"); image.loading = "lazy"; image.alt = asset.alt_text || asset.title || "Media asset";
      const publicUrl = safeUrl(asset.public_url, true); if (publicUrl) image.src = publicUrl;
      visual.append(image, statusPill(asset.status === "published" ? "Published" : "Draft", asset.status === "published" ? "green" : "gold"));
      const body = el("div", "media-card__body"); body.append(el("h4", "", asset.title), el("p", "", `${asset.kind} · ${asset.alt_text || "No alt text"}`));
      const actions = el("div", "media-card__actions");
      [["logo", "Use as logo"], ["hero", "Use as hero"], ["story", "Use as story"], ["favicon", "Use as icon"]].forEach(([target, label]) => {
        const button = el("button", "small-action", label); button.type = "button"; button.addEventListener("click", () => applyAssetToSetting(asset, target)); actions.append(button);
      });
      const toggle = el("button", "small-action", asset.status === "published" ? "Unpublish" : "Publish"); toggle.type = "button"; toggle.addEventListener("click", () => toggleMediaStatus(asset)); actions.append(toggle);
      const remove = el("button", "small-action danger-action", "Delete"); remove.type = "button"; remove.addEventListener("click", () => deleteMedia(asset)); actions.append(remove);
      body.append(actions); card.append(visual, body); grid.append(card);
    });
  }

  async function applyAssetToSetting(asset, target) {
    if (!db || !isAdmin || !siteSettings) return;
    const fieldByTarget = { logo: "logo_url", hero: "hero_image_url", story: "story_image_url", favicon: "favicon_url" };
    const field = fieldByTarget[target]; if (!field) return;
    try {
      const { data, error } = await db.from("site_settings").update({ [field]: asset.public_url }).eq("id", 1).select("*").single();
      if (error) throw error;
      siteSettings = { ...siteSettings, ...data };
      const fieldEl = $(`#settingsForm [name="${field}"]`);
      if (fieldEl) {
        fieldEl.value = asset.public_url;
        updateImagePreview(field, asset.public_url);
      }
      applyAdminBranding(siteSettings);
      showGlobal(`${asset.title} applied as ${target}.`, "success");
    } catch (error) { console.error(error); showGlobal("Could not apply this image to the setting.", "error"); }
  }

  async function toggleMediaStatus(asset) {
    const nextStatus = asset.status === "published" ? "draft" : "published";
    try {
      const { error } = await db.from("media_assets").update({ status: nextStatus }).eq("id", asset.id); if (error) throw error;
      showGlobal(`Media ${nextStatus === "published" ? "published" : "moved to draft"}.`, "success"); await loadDashboardData();
    } catch (error) { console.error(error); showGlobal("Could not update media status.", "error"); }
  }

  async function deleteMedia(asset) {
    if (!(await confirmAction("Delete media asset?", `“${asset.title}” will be removed from your media library. If a page currently uses its URL, replace that field too.`, "Delete asset"))) return;
    try {
      const { error } = await db.from("media_assets").delete().eq("id", asset.id); if (error) throw error;
      if (asset.storage_path) {
        const { error: storageError } = await db.storage.from(BUCKET).remove([asset.storage_path]);
        if (storageError) console.warn("Metadata removed, but storage cleanup failed", storageError);
      }
      showGlobal("Media asset deleted.", "success"); await loadDashboardData();
    } catch (error) { console.error(error); showGlobal("Could not delete this asset. Check if another page setting still uses it.", "error"); }
  }

  async function uploadMedia(event) {
    event.preventDefault(); if (!db || !isAdmin || !currentUser) return;
    const form = event.currentTarget; if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries()); const file = form.elements.namedItem("file").files?.[0];
    if (!file) { $status("#mediaStatus", "Choose an image first.", "error"); return; }
    const button = form.querySelector("button[type='submit']"); const progress = $("#uploadProgress");
    button.disabled = true; if (progress) progress.hidden = false; $status("#mediaStatus", "Preparing image…");
    let uploadedPath = "";
    try {
      const compressed = await compressImage(file);
      const safeName = compressed.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90);
      uploadedPath = `${currentUser.id}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName}`;
      $status("#mediaStatus", `Uploading ${(compressed.size / 1024 / 1024).toFixed(2)} MB…`);
      const { error: uploadError } = await db.storage.from(BUCKET).upload(uploadedPath, compressed, { cacheControl: "3600", upsert: false, contentType: compressed.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = db.storage.from(BUCKET).getPublicUrl(uploadedPath);
      if (!publicData?.publicUrl) throw new Error("Could not create a public image URL.");
      const payload = {
        title: String(data.title || compressed.name).trim(), alt_text: String(data.alt_text || "").trim(),
        public_url: publicData.publicUrl, storage_path: uploadedPath, kind: String(data.kind || "gallery"),
        status: String(data.status || "draft"), licence_notes: String(data.licence_notes || "").trim(), created_by: currentUser.id
      };
      const { error: insertError } = await db.from("media_assets").insert(payload);
      if (insertError) throw insertError;
      form.reset(); $status("#mediaStatus", "Image uploaded and saved to your media library.", "success");
      showGlobal("Image uploaded successfully.", "success"); await loadDashboardData();
    } catch (error) {
      console.error("Media upload failed", error);
      if (uploadedPath) { const { error: cleanupError } = await db.storage.from(BUCKET).remove([uploadedPath]); if (cleanupError) console.warn("Upload cleanup failed", cleanupError); }
      $status("#mediaStatus", error?.message || "Image upload failed. Check image type, size and storage policies.", "error");
    } finally { button.disabled = false; if (progress) progress.hidden = true; }
  }

  function renderReviews() {
    const list = $("#reviewList"); if (!list) return;
    const filter = $("#reviewFilter")?.value || "pending";
    const rows = reviewRows.filter(review => filter === "all" || review.status === filter || (filter === "pending" && review.status === "pending"));
    list.replaceChildren();
    if (!rows.length) { list.append(emptyState("No reviews in this view", filter === "pending" ? "New customer reviews will arrive here as pending." : "Choose another filter to view other reviews.")); return; }
    rows.forEach(review => {
      const card = el("article", "record-card");
      const top = el("div", "record-card__top"); const info = el("div");
      info.append(el("h3", "record-card__title", review.display_name || "Guest"));
      info.append(el("p", "record-card__meta", `${new Date(review.created_at).toLocaleString()} · ${review.feeling || "No feeling selected"} · ${review.consent_publication ? "Publication consent recorded" : "No publication consent"}`));
      const right = el("div"); right.append(el("div", "review-stars-admin", "★".repeat(Math.min(5, Math.max(1, Number(review.rating) || 1)))), statusPill(review.status, review.status === "approved" ? "green" : review.status === "rejected" || review.status === "hidden" ? "red" : "gold"));
      top.append(info, right); card.append(top);
      const quote = el("blockquote", "", review.review_text || ""); card.append(quote);
      const actions = el("div", "record-card__actions");
      const statusLabel = el("label", "", "Moderation status"); const status = el("select");
      [["pending", "Pending"], ["approved", "Approved / public"], ["rejected", "Rejected"], ["hidden", "Hidden"]].forEach(([value, label]) => { const option = el("option", "", label); option.value = value; status.append(option); }); status.value = review.status; statusLabel.append(status);
      const checkLabel = el("label", "inline-check"); const check = el("input"); check.type = "checkbox"; check.checked = Boolean(review.highlight); check.disabled = !review.consent_publication; checkLabel.append(check, el("span", "", "Highlight"));
      const save = el("button", "small-action", "Save review"); save.type = "button"; save.addEventListener("click", async () => {
        if (check.checked && status.value !== "approved") { showGlobal("Approve a review before highlighting it.", "error"); return; }
        if (check.checked && !review.consent_publication) { showGlobal("This review did not include consent for publication, so it cannot be highlighted.", "error"); return; }
        if (status.value === "approved" && !review.consent_publication) { showGlobal("The guest did not consent to public display. Do not approve publication without appropriate consent.", "error"); return; }
        const payload = { status: status.value, highlight: check.checked, moderated_at: status.value === "pending" ? null : new Date().toISOString() };
        try { const { error } = await db.from("reviews").update(payload).eq("id", review.id); if (error) throw error; showGlobal("Review moderation saved.", "success"); await loadDashboardData(); }
        catch (error) { console.error(error); showGlobal("Review update failed. Check admin policies.", "error"); }
      });
      const remove = el("button", "small-action", "Delete"); remove.type = "button"; remove.classList.add("danger-action"); remove.addEventListener("click", () => deleteRecord("reviews", review.id, "Delete guest review?", "This review will be permanently removed."));
      actions.append(statusLabel, checkLabel, save, remove); card.append(actions); list.append(card);
    });
  }

  function renderMessages() {
    const list = $("#messageList"); if (!list) return;
    const filter = $("#messageFilter")?.value || "open";
    const rows = messageRows.filter(row => filter === "all" || (filter === "open" && ["new", "read"].includes(row.status)) || row.status === filter);
    setText("#messageCountLabel", `${messageRows.length} total message${messageRows.length === 1 ? "" : "s"}`);
    list.replaceChildren();
    if (!rows.length) { list.append(emptyState("Inbox is clear", "New contact form submissions will arrive here.")); return; }
    rows.forEach(message => {
      const card = el("article", "record-card"); const top = el("div", "record-card__top"); const info = el("div");
      info.append(el("h3", "record-card__title", message.subject || "Website enquiry"));
      info.append(el("p", "record-card__meta", `${message.customer_name || "Customer"} · ${message.email || "No email"} · ${message.phone || "No phone"} · ${new Date(message.created_at).toLocaleString()}`));
      top.append(info, statusPill(message.status, message.status === "replied" || message.status === "closed" ? "green" : message.status === "spam" ? "red" : "gold")); card.append(top);
      card.append(el("p", "record-card__body", message.message || ""));
      const actions = el("div", "record-card__actions"); const stateLabel = el("label", "", "Message status"); const state = el("select");
      [["new", "New"], ["read", "Read"], ["replied", "Replied"], ["closed", "Closed"], ["spam", "Spam"]].forEach(([value, label]) => { const op = el("option", "", label); op.value = value; state.append(op); }); state.value = message.status; stateLabel.append(state);
      const noteLabel = el("label", "", "Private admin note"); const note = el("textarea"); note.rows = 2; note.maxLength = 1000; note.value = message.admin_note || ""; noteLabel.append(note);
      const save = el("button", "small-action", "Save update"); save.type = "button"; save.addEventListener("click", async () => {
        try { const { error } = await db.from("contact_messages").update({ status: state.value, admin_note: note.value.trim() }).eq("id", message.id); if (error) throw error; showGlobal("Contact message updated.", "success"); await loadDashboardData(); }
        catch (error) { console.error(error); showGlobal("Could not update this message.", "error"); }
      });
      const del = el("button", "small-action", "Delete"); del.type = "button"; del.classList.add("danger-action"); del.addEventListener("click", () => deleteRecord("contact_messages", message.id, "Delete this message?", "The message and its private notes will be permanently removed."));
      actions.append(stateLabel, noteLabel, save, del); card.append(actions); list.append(card);
    });
  }

  async function deleteRecord(table, id, title, message) {
    if (!(await confirmAction(title, message, "Delete permanently"))) return;
    try { const { error } = await db.from(table).delete().eq("id", id); if (error) throw error; showGlobal("Record deleted.", "success"); await loadDashboardData(); }
    catch (error) { console.error(error); showGlobal("Could not delete this record. Verify admin permission.", "error"); }
  }

  function setupFilters() {
    ["#mediaFilter", "#reviewFilter", "#messageFilter"].forEach(selector => $(selector)?.addEventListener("change", () => {
      if (selector === "#mediaFilter") renderMedia();
      if (selector === "#reviewFilter") renderReviews();
      if (selector === "#messageFilter") renderMessages();
    }));
  }

  function setupForms() {
    $("#settingsForm")?.addEventListener("input", () => { $("#settingsForm").dataset.dirty = "true"; });
    $("#settingsForm")?.addEventListener("change", () => { $("#settingsForm").dataset.dirty = "true"; });
    $("#settingsForm")?.addEventListener("submit", saveSettingsFromForm);
    $$(".settings-image-upload").forEach(input => input.addEventListener("change", uploadInlineSettingImage));
    $$('[data-preview-field]').forEach(field => field.addEventListener("input", () => {
      if (field.dataset.previewField === "cuisine_image_url") updateCuisineImagePreview(field.value);
      else updateImagePreview(field.dataset.previewField, field.value);
    }));
    $("#cuisineImageFile")?.addEventListener("change", uploadCuisineImage);
    $("#cuisineImageUrl")?.addEventListener("input", event => updateCuisineImagePreview(event.currentTarget.value));
    ["theme_hero_shape", "theme_story_shape", "theme_cuisine_shape", "theme_gallery_shape"].forEach(name => {
      $(`#settingsForm [name="${name}"]`)?.addEventListener("change", updateShapePreviews);
    });
    $("#addCuisineButton")?.addEventListener("click", () => openCuisineEditor(null));
    $("#cancelCuisineEdit")?.addEventListener("click", () => { $("#cuisineEditorWrap").hidden = true; });
    $("#cuisineForm")?.addEventListener("submit", saveCuisine);
    $("#deleteCuisineButton")?.addEventListener("click", deleteCuisine);
    $("#mediaUploadForm")?.addEventListener("submit", uploadMedia);
  }

  async function restoreExistingSession() {
    if (!backend.ready || !db) { showLogin(); return; }
    try {
      const { data: publicBranding, error: brandingError } = await db.from("site_settings").select("brand_name, logo_url, favicon_url").eq("id", 1).maybeSingle();
      if (!brandingError && publicBranding) applyAdminBranding(publicBranding);
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      const recoveryRoute = new URLSearchParams(window.location.search).get("recovery") === "1";
      if (recoveryRoute) {
        if (data?.session?.user) showPasswordReset();
        else showLogin("This password reset link is invalid or has expired. Request a new link below.", "error");
      } else if (data?.session?.user) {
        await validateSessionAndEnter(data.session.user);
      } else {
        showLogin();
      }
      db.auth.onAuthStateChange((_event, session) => {
        if (!session?.user && isAdmin) { stopAdminRealtime(); currentUser = null; isAdmin = false; showLogin("Your session ended. Sign in again to continue."); }
      });
      // A cheap settings query confirms whether the Data API is reachable before dashboard is used.
      const { error: settingsError } = await db.from("site_settings").select("id").eq("id", 1).maybeSingle();
      if (!settingsError) setHealth("#healthDatabase", "#healthDatabaseText", "Connected", true);
      else setHealth("#healthDatabase", "#healthDatabaseText", "Check migration", false);
      setHealth("#healthStorage", "#healthStorageText", "Requires an admin upload test", null);
    } catch (error) {
      console.error("Session restore failed", error);
      showLogin("Could not contact Supabase. Check the project URL, publishable key and internet connection.", "error");
    }
  }

  $("#settingsForm")?.addEventListener("invalid", () => {}, true);
  setupNavigation(); setupConfirm(); setupFilters(); setupForms(); wireLogin();
  setHealth("#healthAuth", "#healthAuthText", backend.ready ? "Checking" : "Not connected", null);
  setHealth("#healthDatabase", "#healthDatabaseText", backend.ready ? "Checking" : "Not connected", null);
  setHealth("#healthStorage", "#healthStorageText", backend.ready ? "Checking" : "Not connected", null);
  restoreExistingSession();
})();
