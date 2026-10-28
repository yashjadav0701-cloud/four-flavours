/* Four Flavours public site — plain JavaScript + Supabase JS v2. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const backend = window.FF_BACKEND || { client: null, ready: false };
  const db = backend.client;

  const DEFAULT_SETTINGS = {
    id: 1,
    brand_name: "Four Flavours",
    tagline: "A world of flavours in every plate.",
    announcement: "A table full of possibilities.",
    logo_url: "",
    favicon_url: "assets/icons/four-flavours-icon.png",
    brand_icon: "4",
    hero_eyebrow: "A LITTLE OF EVERYTHING. A LOT TO LOVE.",
    hero_title: "Four cuisines.\nOne unforgettable\ntable.",
    hero_description: "From familiar favourites to new discoveries, come together over food that brings everyone to the table.",
    hero_image_url: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1800&q=88",
    hero_image_alt: "A colourful spread of freshly prepared food",
    hero_cta_label: "Explore the flavours",
    story_eyebrow: "MORE THAN WHAT’S ON THE PLATE",
    story_title: "A good meal\nis never just\na meal.",
    story_body: "It’s the catch-up that runs late, the first bite everyone wants to try, and the table where nobody checks the time. Four Flavours is built around a simple idea: the best moments happen when we share them.",
    story_image_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85",
    review_title: "Don’t just take\nour word for it.",
    review_subtitle: "Every visit has a story. Read honest guest notes, then come write your own.",
    gallery_title: "A little look\naround the table.",
    gallery_subtitle: "Food, atmosphere and little details that make a visit feel special.",
    visit_title: "A table starts\nwith a call.",
    visit_subtitle: "Call us directly to check availability and arrange your table. We look forward to welcoming you.",
    address: "Vadodara, Gujarat · Add the verified street address before launch.",
    phone: "",
    email: "",
    opening_hours: "Please contact the restaurant to confirm today’s hours.",
    map_url: "https://www.google.com/maps/search/?api=1&query=Four+Flavours+restaurant+Vadodara+Gujarat",
    google_review_url: "",
    social_links: { instagram: "", facebook: "", whatsapp: "", youtube: "", googleBusiness: "" },
    theme: { accent: "#B64F38", accent_dark: "#8E3828", paper: "#F6F0E6", paper_deep: "#EEE5D8", ink: "#20211D", ink_soft: "#52534B", olive: "#53664E", gold: "#D4A74F", surface: "#FFFDF8", line: "#D6CFC1", logo_width: 280 },
    meta_title: "Four Flavours | A world of flavours in every plate",
    meta_description: "Discover Four Flavours: four cuisine traditions, warm hospitality, honest guest reviews and a table waiting for you in Vadodara."
  };

  const FALLBACK_CUISINES = [
    { slug: "indian", sort_order: 1, eyebrow: "01 / WARM & SOULFUL", title: "Indian", description: "Familiar favourites, aromatic spices and layers of flavour worth slowing down for.", image_url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1000&q=85", image_alt: "Indian curry with herbs and spices", accent_color: "#D97745", is_active: true },
    { slug: "chinese", sort_order: 2, eyebrow: "02 / BOLD & WOK-FIRED", title: "Chinese", description: "Big textures, savoury notes and delicious energy from the wok.", image_url: "https://images.unsplash.com/photo-1760699609029-01bcc566ab50?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000", image_alt: "Chinese noodles with dumplings and fresh greens", accent_color: "#C65446", is_active: true },
    { slug: "continental", sort_order: 3, eyebrow: "03 / SIMPLE & REFINED", title: "Continental", description: "Thoughtful plates, comforting classics and contemporary favourites.", image_url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=85", image_alt: "Freshly plated pasta with herbs", accent_color: "#B58A4C", is_active: true },
    { slug: "mexican", sort_order: 4, eyebrow: "04 / BRIGHT & BOLD", title: "Mexican", description: "Fresh, punchy flavours and colourful combinations for adventurous appetites.", image_url: "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1000&q=85", image_alt: "Colourful tacos with fresh ingredients", accent_color: "#78905B", is_active: true }
  ];

  let settings = structuredCloneSafe(DEFAULT_SETTINGS);
  let cuisines = FALLBACK_CUISINES.slice();
  let reviews = [];
  let googleReviewsLoaded = false;
  let galleryItems = [];
  let toastTimer = null;

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeUrl(value, { relative = false } = {}) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (relative && (/^\.\.?\//.test(raw) || raw.startsWith("/"))) return raw;
    try {
      const parsed = new URL(raw, window.location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch (_) {
      return "";
    }
  }

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value == null ? "" : String(value);
  }

  function setLinesHeading(selector, value, lastLineItalic = true) {
    const node = $(selector);
    if (!node) return;
    const raw = String(value || "").trim();
    const lines = (raw.includes("\n") ? raw.split(/\r?\n/) : [raw]).map(line => line.trim()).filter(Boolean);
    node.replaceChildren();
    lines.forEach((line, index) => {
      if (index > 0) node.append(document.createElement("br"));
      if (lastLineItalic && index === lines.length - 1) {
        const em = document.createElement("em");
        em.textContent = line;
        node.append(em);
      } else {
        node.append(document.createTextNode(line));
      }
    });
  }

  function setImage(nodeOrSelector, rawUrl, altText) {
    const node = typeof nodeOrSelector === "string" ? $(nodeOrSelector) : nodeOrSelector;
    if (!node) return;
    const url = safeUrl(rawUrl, { relative: true });
    if (altText != null) node.alt = String(altText);
    node.onerror = () => {
      node.onerror = null;
      const description = String(altText || node.alt || "");
      if (/chinese|dumpling|noodle|wok/i.test(description) && node.dataset.chineseFallbackUsed !== "true") {
        node.dataset.chineseFallbackUsed = "true";
        node.onerror = () => {
          node.onerror = null;
          node.removeAttribute("src");
          node.style.background = "#d8c9b6";
          node.setAttribute("data-image-error", "true");
        };
        node.src = "https://images.unsplash.com/photo-1761125066136-f657176f7525?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000";
        return;
      }
      node.removeAttribute("src");
      node.style.background = "#d8c9b6";
      node.setAttribute("data-image-error", "true");
    };
    if (url) node.src = url;
  }

  function setExternalLink(selector, rawUrl, fallback = "#visit") {
    const node = $(selector);
    if (!node) return;
    const url = safeUrl(rawUrl);
    node.href = url || fallback;
    node.setAttribute("aria-disabled", String(!url));
    node.toggleAttribute("data-disabled-link", !url);
    node.onclick = !url ? (event) => { event.preventDefault(); showToast("This link has not been configured yet."); } : null;
    if (url && /^https?:/.test(url)) {
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  }

  function setEmailAndPhone() {
    const phone = String(settings.phone || "").trim();
    // Share the normalized number with both call-to-action links.
    const digits = phone.replace(/[^+\d]/g, "");
    const phoneLink = $("#phoneLink");
    if (phoneLink) {
      phoneLink.href = digits ? `tel:${digits}` : "#visit";
      phoneLink.setAttribute("aria-disabled", String(!digits));
      phoneLink.onclick = digits ? null : (event) => { event.preventDefault(); showToast("Add the restaurant phone in Admin → Website & branding."); };
      phoneLink.setAttribute("aria-label", digits ? `Call Four Flavours at ${phone} to book a table` : "Restaurant phone has not been configured yet");
    }
    const phoneTextLink = $("#phoneNumberText");
    if (phoneTextLink) {
      phoneTextLink.textContent = phone || "Add restaurant phone in admin settings";
      phoneTextLink.href = digits ? `tel:${digits}` : "#visit";
      phoneTextLink.setAttribute("aria-disabled", String(!digits));
      phoneTextLink.onclick = digits ? null : (event) => { event.preventDefault(); showToast("Add the restaurant phone in Admin → Website & branding."); };
    }
    const emailLink = $("#emailLink");
    if (emailLink) {
      emailLink.textContent = settings.email || "Add a contact email";
      emailLink.href = settings.email ? `mailto:${settings.email}` : "#visit";
      emailLink.setAttribute("aria-disabled", String(!settings.email));
      emailLink.onclick = settings.email ? null : (event) => { event.preventDefault(); showToast("Add the restaurant email in the admin studio."); };
    }
  }

  function setBrandImages() {
    // Keep the approved complete logo visible even before a custom upload is configured.
    const logoUrl = safeUrl(settings.logo_url, { relative: true }) || "assets/images/four-flavours-logo.png";
    $$(".brand").forEach((brand) => {
      let image = $(".brand__image", brand);
      const mark = $(".brand__mark", brand);
      if (logoUrl) {
        if (!image) {
          image = document.createElement("img");
          image.className = "brand__image";
          image.alt = `${settings.brand_name || "Four Flavours"} logo`;
          image.loading = "eager";
          brand.insertBefore(image, brand.firstChild);
        }
        setImage(image, logoUrl, `${settings.brand_name || "Four Flavours"} logo`);
        if (mark) mark.hidden = true;
      } else {
        if (image) image.remove();
        if (mark) {
          mark.hidden = false;
          const iconText = String(settings.brand_icon || "4").slice(0, 3);
          const span = $("span", mark);
          if (span) span.textContent = iconText;
        }
      }
      const wordmark = $(".brand__wordmark strong", brand);
      const tagline = $(".brand__wordmark small", brand);
      if (wordmark) wordmark.textContent = settings.brand_name || "Four Flavours";
      if (tagline) tagline.textContent = settings.tagline || "Good food. Good company.";
    });
    const faviconUrl = safeUrl(settings.favicon_url, { relative: true });
    if (faviconUrl) {
      let icon = $("link[rel='icon']");
      if (!icon) {
        icon = document.createElement("link"); icon.rel = "icon"; document.head.append(icon);
      }
      icon.href = faviconUrl;
    }
  }

  function applyTheme(theme) {
    const t = { ...DEFAULT_SETTINGS.theme, ...(theme || {}) };
    const root = document.documentElement;
    const cssTokens = {
      accent: "--clay", accent_dark: "--clay-dark", paper: "--paper", paper_deep: "--paper-deep",
      ink: "--ink", ink_soft: "--ink-soft", olive: "--sage", gold: "--gold", surface: "--white", line: "--line"
    };
    Object.entries(cssTokens).forEach(([key, token]) => {
      if (/^#[\da-f]{6}$/i.test(t[key] || "")) root.style.setProperty(token, t[key]);
    });
    const logoWidth = Number(t.logo_width);
    if (Number.isFinite(logoWidth) && logoWidth >= 200 && logoWidth <= 360) root.style.setProperty("--brand-logo-width", `${logoWidth}px`);
    const meta = $("#themeColorMeta");
    if (meta && /^#[\da-f]{6}$/i.test(t.paper || "")) meta.content = t.paper;
  }

  function renderSocialLinks() {
    const parent = $("#socialLinks");
    if (!parent) return;
    parent.replaceChildren();
    const social = settings.social_links && typeof settings.social_links === "object" ? settings.social_links : {};
    const items = [
      ["instagram", "Instagram", "◎"], ["facebook", "Facebook", "f"],
      ["whatsapp", "WhatsApp", "◔"], ["youtube", "YouTube", "▶"],
      ["googleBusiness", "Google", "G" ]
    ];
    items.forEach(([key, label, icon]) => {
      const url = safeUrl(social[key]);
      if (!url) return;
      const a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", label); a.title = label; a.textContent = icon;
      parent.append(a);
    });
    if (!parent.children.length) parent.hidden = true; else parent.hidden = false;
  }

  function applySettings() {
    document.title = settings.meta_title || `${settings.brand_name || "Four Flavours"} | A world of flavours in every plate`;
    const description = $("meta[name='description']");
    if (description) description.content = settings.meta_description || DEFAULT_SETTINGS.meta_description;
    const ogTitle = $("meta[property='og:title']");
    if (ogTitle) ogTitle.content = document.title;
    const ogDescription = $("meta[property='og:description']");
    if (ogDescription) ogDescription.content = settings.meta_description || DEFAULT_SETTINGS.meta_description;

    setBrandImages();
    setText("#announcementText", settings.announcement || DEFAULT_SETTINGS.announcement);
    setText("#heroEyebrow", settings.hero_eyebrow || DEFAULT_SETTINGS.hero_eyebrow);
    setLinesHeading("#heroTitle", settings.hero_title || DEFAULT_SETTINGS.hero_title, true);
    setText("#heroDescription", settings.hero_description || DEFAULT_SETTINGS.hero_description);
    const heroCta = $("#heroCta");
    if (heroCta) {
      heroCta.replaceChildren(document.createTextNode(settings.hero_cta_label || DEFAULT_SETTINGS.hero_cta_label));
      const arrow = document.createElement("span"); arrow.setAttribute("aria-hidden", "true"); arrow.textContent = "↘"; heroCta.append(arrow);
    }
    setImage("#heroImage", settings.hero_image_url || DEFAULT_SETTINGS.hero_image_url, settings.hero_image_alt || DEFAULT_SETTINGS.hero_image_alt);
    setText("#heroImageCaption", "A world of flavour");

    setText("#storyEyebrow", settings.story_eyebrow || DEFAULT_SETTINGS.story_eyebrow);
    setLinesHeading("#storyTitle", settings.story_title || DEFAULT_SETTINGS.story_title, true);
    setText("#storyText", settings.story_body || DEFAULT_SETTINGS.story_body);
    setImage("#storyImage", settings.story_image_url || DEFAULT_SETTINGS.story_image_url, "Four Flavours dining space");
    setLinesHeading("#reviewsTitle", settings.review_title || DEFAULT_SETTINGS.review_title, true);
    setText("#reviewsSubtitle", settings.review_subtitle || DEFAULT_SETTINGS.review_subtitle);
    setLinesHeading("#galleryTitle", settings.gallery_title || DEFAULT_SETTINGS.gallery_title, true);
    setText("#gallerySubtitle", settings.gallery_subtitle || DEFAULT_SETTINGS.gallery_subtitle);
    setLinesHeading("#visitTitle", settings.visit_title || DEFAULT_SETTINGS.visit_title, true);
    setText("#visitSubtitle", settings.visit_subtitle || DEFAULT_SETTINGS.visit_subtitle);
    setText("#addressText", settings.address || DEFAULT_SETTINGS.address);
    setText("#hoursText", settings.opening_hours || DEFAULT_SETTINGS.opening_hours);
    setExternalLink("#directionsLink", settings.map_url, "#visit");
    setExternalLink("#allReviewsLink", settings.google_review_url, "#reviews");
    setExternalLink("#writeReviewLink", settings.google_review_url, "#reviews");
    setExternalLink("#instagramLink", settings.social_links?.instagram, "#visit");
    setEmailAndPhone();
    renderSocialLinks();
    applyTheme(settings.theme);
    setText("#year", String(new Date().getFullYear()));

  }

  function renderCuisines(items) {
    const grid = $(".cuisine-grid");
    if (!grid) return;
    const active = (items || FALLBACK_CUISINES).filter(item => item.is_active !== false).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    grid.replaceChildren();
    if (!active.length) {
      const empty = document.createElement("p"); empty.className = "section-intro"; empty.textContent = "Our next flavours are being prepared. Please check back soon."; grid.append(empty); return;
    }
    active.forEach((item, index) => {
      const slug = /^[a-z0-9-]{2,50}$/.test(String(item.slug || "")) ? item.slug : `cuisine-${index + 1}`;
      const article = document.createElement("article");
      article.className = `cuisine-card cuisine-card--${slug} reveal is-visible`;
      article.style.setProperty("--card-accent", /^#[\da-f]{6}$/i.test(item.accent_color || "") ? item.accent_color : "var(--clay)");
      article.dataset.cuisine = String(item.title || "Cuisine");
      const visual = document.createElement("div"); visual.className = "cuisine-card__image";
      const image = document.createElement("img"); image.loading = "lazy";
      setImage(image, item.image_url || DEFAULT_SETTINGS.hero_image_url, item.image_alt || `${item.title || "Cuisine"} food`);
      // Keep the food photograph clean: no hover arrow or icon overlay is added to cuisine imagery.
      const number = document.createElement("span"); number.className = "cuisine-card__number"; number.textContent = String(index + 1).padStart(2, "0");
      visual.append(image, number);
      const meta = document.createElement("div"); meta.className = "cuisine-card__meta";
      const eye = document.createElement("span"); eye.textContent = item.eyebrow || `${String(index + 1).padStart(2, "0")} / FROM OUR KITCHEN`;
      const titleMeta = document.createElement("span"); titleMeta.textContent = String(item.title || "Cuisine").toUpperCase();
      meta.append(eye, titleMeta);
      const h3 = document.createElement("h3");
      const titleWords = String(item.title || "Cuisine");
      h3.append(document.createTextNode(titleWords + " with "));
      const em = document.createElement("em"); em.textContent = "character."; h3.append(em);
      const description = document.createElement("p"); description.textContent = item.description || "Freshly prepared favourites, served with warmth.";
      article.append(visual, meta, h3, description);
      grid.append(article);
    });
    if (window.lucide && typeof window.lucide.createIcons === "function") { try { window.lucide.createIcons(); } catch (_) {} }
  }

  function renderReviews() {
    const grid = $("#reviewGrid");
    if (!grid) return;
    const approved = reviews.filter(review => review.status === "approved").sort((a, b) => Number(Boolean(b.highlight)) - Number(Boolean(a.highlight)) || new Date(b.created_at) - new Date(a.created_at));
    grid.replaceChildren();
    if (!approved.length) {
      const empty = document.createElement("article");
      empty.className = "review-card review-card--empty reveal is-visible";
      const kicker = document.createElement("span"); kicker.className = "review-source"; kicker.textContent = "GUEST VOICES";
      const title = document.createElement("h3"); title.textContent = "Your experience belongs here.";
      const copy = document.createElement("p"); copy.textContent = "Be one of the first guests to share an honest note. Every review is checked before it appears here.";
      const button = document.createElement("button"); button.type = "button"; button.className = "button button--dark"; button.dataset.openReview = "true"; button.textContent = "Write the first review ↗";
      empty.append(kicker, title, copy, button); grid.append(empty);
    } else {
      approved.slice(0, 4).forEach((review) => {
        const card = document.createElement("article"); card.className = "review-card reveal is-visible";
        const top = document.createElement("div"); top.className = "review-card__top";
        const source = document.createElement("span"); source.className = "review-source"; source.textContent = "FOUR FLAVOURS · GUEST REVIEW";
        const stars = document.createElement("span"); stars.className = "review-stars"; stars.textContent = "★".repeat(Math.min(5, Math.max(1, Number(review.rating) || 1)));
        top.append(source, stars);
        const quote = document.createElement("blockquote"); quote.textContent = `“${review.review_text || ""}”`;
        const author = document.createElement("div"); author.className = "review-card__author";
        const avatar = document.createElement("span"); avatar.className = "author-avatar"; avatar.textContent = String(review.display_name || "G").trim().charAt(0).toUpperCase();
        const byline = document.createElement("span");
        const name = document.createElement("strong"); name.textContent = review.display_name || "Guest";
        const detail = document.createElement("small"); detail.textContent = [review.feeling, review.created_at ? new Date(review.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ");
        byline.append(name, detail); author.append(avatar, byline);
        card.append(top);
        if (review.highlight) { const badge = document.createElement("span"); badge.className = "review-card__highlight"; badge.textContent = "Featured guest note"; card.append(badge); }
        card.append(quote, author); grid.append(card);
      });
      const average = approved.reduce((sum, item) => sum + Number(item.rating || 0), 0) / approved.length;
      setText("#ratingNumber", average.toFixed(1));
      setText("#ratingCaption", `${approved.length} approved guest ${approved.length === 1 ? "review" : "reviews"}`);
    }
    if (!approved.length) {
      setText("#ratingNumber", "—");
      setText("#ratingCaption", "Be the first to share your experience");
    }
    const promo = document.createElement("article"); promo.className = "review-card review-card--accent reveal is-visible";
    const quoteMark = document.createElement("span"); quoteMark.className = "review-card__quote"; quoteMark.setAttribute("aria-hidden", "true"); quoteMark.textContent = "“";
    const title = document.createElement("h3"); title.append(document.createTextNode("Your next"), document.createElement("br")); const em = document.createElement("em"); em.textContent = "favourite story"; title.append(em, document.createElement("br"), document.createTextNode("could be yours."));
    const button = document.createElement("button"); button.type = "button"; button.className = "button button--light"; button.dataset.openReview = "true"; button.textContent = "Share your experience ↗";
    promo.append(quoteMark, title, button);
    if (safeUrl(settings.google_review_url)) {
      const external = document.createElement("a"); external.className = "text-link"; external.href = safeUrl(settings.google_review_url); external.target = "_blank"; external.rel = "noopener noreferrer"; external.textContent = "Also review us on Google ↗"; promo.append(external);
    }
    grid.append(promo);
    bindReviewButtons();
  }

  function renderGoogleReviews(payload) {
    const section = $("#googleReviewsSection");
    const grid = $("#googleReviewGrid");
    if (!section || !grid || !payload || !Array.isArray(payload.reviews)) return;
    const cards = payload.reviews.filter(review => review && (review.text?.text || review.originalText?.text));
    if (!cards.length) { section.hidden = true; return; }

    section.hidden = false;
    setText("#googleReviewsPlaceName", payload.displayName?.text || "Guest reviews on Google");
    const rating = Number(payload.rating);
    setText("#googleReviewsRating", Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "Google");
    const total = Number(payload.userRatingCount);
    setText("#googleReviewsCount", Number.isFinite(total) && total >= 0 ? `${total.toLocaleString()} Google rating${total === 1 ? "" : "s"}` : "Reviews on Google");

    const mapsHref = safeUrl(payload.googleMapsUri) || safeUrl(settings.google_review_url) || safeUrl(settings.social_links?.googleBusiness);
    const mapsLink = $("#googleReviewsMapsLink");
    if (mapsLink) {
      mapsLink.hidden = !mapsHref;
      mapsLink.href = mapsHref || "#reviews";
      if (mapsHref) { mapsLink.target = "_blank"; mapsLink.rel = "noopener noreferrer"; }
    }

    grid.replaceChildren();
    cards.slice(0, 5).forEach((review) => {
      const card = document.createElement("article"); card.className = "google-review-card";
      const top = document.createElement("div"); top.className = "google-review-card__top";
      const source = document.createElement("span"); source.className = "google-review-source"; source.textContent = "GOOGLE MAPS REVIEW";
      const count = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
      const stars = document.createElement("span"); stars.className = "google-review-stars"; stars.textContent = `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
      stars.setAttribute("aria-label", `${count} out of 5 stars`); top.append(source, stars);
      const text = document.createElement("blockquote"); text.textContent = review.text?.text || review.originalText?.text || "";
      const author = review.authorAttribution || {};
      const authorRow = document.createElement("div"); authorRow.className = "google-review-author";
      if (safeUrl(author.photoUri)) {
        const avatar = document.createElement("img"); avatar.className = "google-review-author__photo"; avatar.src = safeUrl(author.photoUri); avatar.alt = ""; avatar.loading = "lazy"; avatar.referrerPolicy = "no-referrer";
        authorRow.append(avatar);
      }
      const byline = document.createElement("div"); byline.className = "google-review-author__byline";
      const authorName = String(author.displayName || "Google reviewer");
      const authorHref = safeUrl(author.uri);
      const nameNode = authorHref ? document.createElement("a") : document.createElement("span");
      nameNode.className = "google-review-author__name"; nameNode.textContent = authorName;
      if (authorHref) { nameNode.href = authorHref; nameNode.target = "_blank"; nameNode.rel = "noopener noreferrer"; }
      const date = document.createElement("small"); date.textContent = String(review.relativePublishTimeDescription || (review.publishTime ? new Date(review.publishTime).toLocaleDateString() : ""));
      byline.append(nameNode); if (date.textContent) byline.append(date); authorRow.append(byline); card.append(top, text, authorRow);
      const reviewHref = safeUrl(review.googleMapsUri);
      if (reviewHref) {
        const sourceLink = document.createElement("a");
        sourceLink.className = "google-review-card__source-link";
        sourceLink.href = reviewHref; sourceLink.target = "_blank"; sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = "View this review on Google Maps ↗";
        sourceLink.setAttribute("aria-label", `View ${authorName}’s original review on Google Maps`);
        card.append(sourceLink);
      }
      if (safeUrl(review.flagContentUri)) {
        const reportLink = document.createElement("a");
        reportLink.className = "google-review-card__report-link";
        reportLink.href = safeUrl(review.flagContentUri); reportLink.target = "_blank"; reportLink.rel = "noopener noreferrer";
        reportLink.textContent = "Report review ↗";
        reportLink.setAttribute("aria-label", `Report ${authorName}’s review to Google`);
        card.append(reportLink);
      }
      grid.append(card);
    });

    const attribution = $("#googleReviewsAttributions");
    if (attribution) {
      attribution.replaceChildren(document.createTextNode("Reviews and ratings supplied by "));
      const maps = document.createElement("a"); maps.className = "google-maps-attribution-link"; maps.href = mapsHref || "https://maps.google.com/"; maps.target = "_blank"; maps.rel = "noopener noreferrer"; maps.textContent = "Google Maps"; maps.setAttribute("translate", "no");
      attribution.append(maps, document.createTextNode(". Reviews are ordered by relevance, and Google may return up to five. Google does not verify reviews; it checks for and removes fake content when identified. "));
      const policy = document.createElement("a"); policy.href = "https://support.google.com/contributionpolicy/answer/7422880"; policy.target = "_blank"; policy.rel = "noopener noreferrer"; policy.textContent = "Google Maps review policy";
      attribution.append(policy, document.createTextNode(". Review author attributions are provided by Google."));
      const sourceAttributions = Array.isArray(payload.attributions) ? payload.attributions : [];
      sourceAttributions.forEach((item) => {
        if (item?.provider && safeUrl(item.providerUri)) {
          attribution.append(document.createTextNode(" · "));
          const sourceLink = document.createElement("a"); sourceLink.href = safeUrl(item.providerUri); sourceLink.target = "_blank"; sourceLink.rel = "noopener noreferrer"; sourceLink.textContent = item.provider; attribution.append(sourceLink);
        }
      });
    }
    googleReviewsLoaded = true;
  }

  async function loadGoogleReviews() {
    const config = window.FF_CONFIG || {};
    if (config.googleReviewsEnabled !== true || !backend.ready || !db?.functions?.invoke || googleReviewsLoaded) return;
    try {
      const { data, error } = await db.functions.invoke("google-reviews", { body: {} });
      if (error) throw error;
      renderGoogleReviews(data);
    } catch (error) {
      // This is an optional feature; first-party reviews remain available if the Edge Function is not configured.
      console.info("Optional Google reviews are not available yet. Check the Google review setup guide.", error?.message || error);
      const section = $("#googleReviewsSection"); if (section) section.hidden = true;
    }
  }

  function currentGalleryFromDom() {
    galleryItems = $$(".gallery-item").map((button, index) => {
      const img = $("img", button);
      return { src: img?.src || "", alt: img?.alt || `Four Flavours gallery image ${index + 1}`, title: img?.alt || `Gallery image ${index + 1}` };
    });
  }

  function renderGallery(items) {
    const published = (items || []).filter(item => item.kind === "gallery" && item.status === "published" && safeUrl(item.public_url)).slice(0, 8);
    const grid = $("#galleryGrid");
    if (!grid || !published.length) { currentGalleryFromDom(); return; }
    grid.replaceChildren();
    published.forEach((item, index) => {
      const button = document.createElement("button"); button.type = "button";
      button.className = `gallery-item reveal is-visible${index === 0 ? " gallery-item--large" : index === 3 ? " gallery-item--wide" : ""}`;
      button.dataset.gallery = String(index); button.setAttribute("aria-label", `Open gallery image ${index + 1}`);
      const img = document.createElement("img"); img.loading = "lazy"; setImage(img, item.public_url, item.alt_text || item.title || `Four Flavours image ${index + 1}`);
      const label = document.createElement("span"); label.textContent = String(index + 1).padStart(2, "0") + " ";
      const arrow = document.createElement("i"); arrow.textContent = "↗"; label.append(arrow);
      button.append(img, label); grid.append(button);
    });
    currentGalleryFromDom(); bindGalleryButtons();
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = String(message || "");
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
  }

  function setFormStatus(id, message, kind = "") {
    const node = $(id);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", kind === "error");
    node.classList.toggle("is-success", kind === "success");
  }

  function openDialog(id) {
    const dialog = $(id);
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
    document.body.classList.add("dialog-open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
    if (!$$("dialog[open]").length) document.body.classList.remove("dialog-open");
  }

  function formDataObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function showBackendMissingStatus(formName, statusSelector) {
    if (backend.ready) return false;
    setFormStatus(statusSelector, "This form is ready, but the Supabase project is not connected yet. Add the project URL and publishable key in js/config.js, then apply the master migration.", "error");
    return true;
  }

  function bindReviewButtons() {
    $$('[data-open-review]').forEach(button => {
      button.onclick = () => {
        setFormStatus("#reviewStatus", "");
        openDialog("#reviewDialog");
      };
    });
  }

  function bindGalleryButtons() {
    const lightbox = $("#lightbox");
    $$(".gallery-item").forEach((button) => {
      button.onclick = () => showGalleryImage(Number(button.dataset.gallery) || 0);
    });
    if ($("#lightboxClose")) $("#lightboxClose").onclick = () => closeDialog(lightbox);
    if ($("#lightboxPrev")) $("#lightboxPrev").onclick = () => showGalleryImage(activeGalleryIndex - 1);
    if ($("#lightboxNext")) $("#lightboxNext").onclick = () => showGalleryImage(activeGalleryIndex + 1);
  }
  let activeGalleryIndex = 0;
  let touchStartX = null;
  function showGalleryImage(index) {
    if (!galleryItems.length) currentGalleryFromDom();
    if (!galleryItems.length) return;
    activeGalleryIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[activeGalleryIndex];
    setImage("#lightboxImage", item.src, item.alt);
    setText("#lightboxCaption", `${String(activeGalleryIndex + 1).padStart(2, "0")} / ${String(galleryItems.length).padStart(2, "0")} · ${item.title}`);
    openDialog("#lightbox");
  }

  async function loadContent({ quiet = false } = {}) {
    if (!backend.ready || !db) {
      applySettings(); renderCuisines(cuisines); renderReviews(); currentGalleryFromDom(); bindGalleryButtons();
      if (!quiet) console.info("Four Flavours is in preview mode. Configure js/config.js to connect Supabase.");
      return;
    }
    try {
      const [settingsResult, cuisinesResult, reviewsResult, mediaResult] = await Promise.all([
        db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("cuisine_sections").select("id,slug,sort_order,eyebrow,title,description,image_url,image_alt,icon_name,accent_color,is_active,created_at,updated_at").order("sort_order", { ascending: true }),
        db.from("reviews").select("id,display_name,rating,feeling,review_text,status,consent_publication,highlight,created_at,updated_at").eq("status", "approved").order("created_at", { ascending: false }).limit(40),
        db.from("media_assets").select("id,title,alt_text,public_url,kind,status,created_at,updated_at").eq("status", "published").order("created_at", { ascending: true })
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (settingsResult.data) settings = { ...DEFAULT_SETTINGS, ...settingsResult.data };
      if (!cuisinesResult.error && Array.isArray(cuisinesResult.data)) cuisines = cuisinesResult.data;
      if (!reviewsResult.error && Array.isArray(reviewsResult.data)) reviews = reviewsResult.data;
      if (!mediaResult.error && Array.isArray(mediaResult.data)) renderGallery(mediaResult.data);
      applySettings();
      renderCuisines(cuisines);
      renderReviews();
      if (!mediaResult.data?.some(item => item.kind === "gallery" && item.status === "published")) currentGalleryFromDom();
      bindGalleryButtons();
      bindReviewButtons();
    } catch (error) {
      console.warn("Could not load live content. Starter content remains visible.", error?.message || error);
      if (!quiet) showToast("Could not refresh live content. Check the Supabase connection and database migration.");
      applySettings(); renderCuisines(cuisines); renderReviews(); currentGalleryFromDom(); bindGalleryButtons();
    }
  }

  function setupNavigation() {
    const header = $("#siteHeader"); const menuToggle = $("#menuToggle"); const mainNav = $("#mainNav");
    function onScroll() {
      header?.classList.toggle("is-scrolled", window.scrollY > 20);
      $("#mobileActions")?.classList.toggle("is-visible", window.scrollY > 450);
    }
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    menuToggle?.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!open));
      menuToggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
      mainNav?.classList.toggle("is-open", !open);
    });
    $$("#mainNav a").forEach(link => link.addEventListener("click", () => {
      menuToggle?.setAttribute("aria-expanded", "false");
      mainNav?.classList.remove("is-open");
    }));
    const revealNodes = $$(".reveal");
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
      }), { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
      revealNodes.forEach(node => observer.observe(node));
      // Dynamic nodes created after observer setup should enter visibly rather than remain hidden.
    } else revealNodes.forEach(node => node.classList.add("is-visible"));
  }

  function setupDialogs() {
    $$('[data-open-contact]').forEach(button => button.addEventListener("click", () => {
      setFormStatus("#contactStatus", ""); openDialog("#contactDialog");
    }));
    $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
    $$("dialog").forEach(dialog => {
      dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
      dialog.addEventListener("close", () => { if (!$$("dialog[open]").length) document.body.classList.remove("dialog-open"); });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !$$("dialog[open]").length) document.body.classList.remove("dialog-open");
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault(); window.location.href = "admin.html";
      }
    });
    $$("[data-rating]").forEach(button => button.addEventListener("click", () => {
      const rating = Math.max(1, Math.min(5, Number(button.dataset.rating) || 5));
      const hidden = $("#reviewForm [name='rating']"); if (hidden) hidden.value = String(rating);
      $$("[data-rating]").forEach(choice => {
        const selected = Number(choice.dataset.rating) === rating;
        choice.classList.toggle("is-selected", selected); choice.setAttribute("aria-pressed", String(selected));
      });
      setText("#ratingLabel", ({ 1: "Could be better — 1 star", 2: "Okay — 2 stars", 3: "Good — 3 stars", 4: "Lovely — 4 stars", 5: "Wonderful — 5 stars" })[rating]);
    }));
    const lightbox = $("#lightbox");
    lightbox?.addEventListener("touchstart", event => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
    lightbox?.addEventListener("touchend", event => {
      if (touchStartX === null) return;
      const distance = event.changedTouches[0]?.clientX - touchStartX;
      if (Math.abs(distance) > 55) showGalleryImage(activeGalleryIndex + (distance < 0 ? 1 : -1));
      touchStartX = null;
    }, { passive: true });
  }

  async function handleReviewSubmit(event) {
    event.preventDefault(); const form = event.currentTarget;
    setFormStatus("#reviewStatus", "");
    const data = formDataObject(form);
    if (String(data.website || "").trim()) { form.reset(); closeDialog($("#reviewDialog")); return; }
    if (showBackendMissingStatus("review", "#reviewStatus")) return;
    const payload = {
      display_name: String(data.display_name || "").trim(), rating: Number(data.rating),
      feeling: String(data.feeling || "Loved it"), review_text: String(data.review_text || "").trim(),
      consent_publication: $("#reviewForm [name='consent_publication']")?.checked === true,
      consent_version: "2026-10-v1"
    };
    if (payload.review_text.length < 12 || payload.review_text.length > 1000 || !payload.consent_publication || payload.rating < 1 || payload.rating > 5) {
      setFormStatus("#reviewStatus", "Please add a 1–5 star rating, a review of at least 12 characters, and publication consent.", "error"); return;
    }
    const submit = $("#reviewForm button[type='submit']"); submit.disabled = true; submit.textContent = "Sending…";
    try {
      const { error } = await db.from("reviews").insert(payload);
      if (error) throw error;
      form.reset();
      const hidden = $("#reviewForm [name='rating']"); if (hidden) hidden.value = "5";
      $$("[data-rating]").forEach(choice => { const selected = choice.dataset.rating === "5"; choice.classList.toggle("is-selected", selected); choice.setAttribute("aria-pressed", String(selected)); });
      setText("#ratingLabel", "Wonderful — 5 stars");
      setFormStatus("#reviewStatus", "Thank you! Your review is in the moderation queue. It will appear here only after approval.", "success");
      showToast("Thank you for sharing your experience.");
      window.setTimeout(() => closeDialog($("#reviewDialog")), 2300);
    } catch (error) {
      console.error("Review submission failed", error);
      setFormStatus("#reviewStatus", "We could not submit your review. Please check the connection and try again.", "error");
    } finally { submit.disabled = false; submit.innerHTML = 'Send my review <span aria-hidden="true">↗</span>'; }
  }

  async function handleContactSubmit(event) {
    event.preventDefault(); const form = event.currentTarget;
    setFormStatus("#contactStatus", "");
    const data = formDataObject(form);
    if (String(data.website || "").trim()) { form.reset(); closeDialog($("#contactDialog")); return; }
    if (showBackendMissingStatus("contact", "#contactStatus")) return;
    const payload = {
      customer_name: String(data.customer_name || "").trim(), email: String(data.email || "").trim(),
      phone: String(data.phone || "").trim(), subject: String(data.subject || "Website enquiry").trim(),
      message: String(data.message || "").trim(), privacy_consent: $("#contactForm [name='privacy_consent']")?.checked === true
    };
    if (payload.customer_name.length < 2 || payload.email.length < 3 || payload.subject.length < 2 || payload.message.length < 5 || !payload.privacy_consent) {
      setFormStatus("#contactStatus", "Please complete all required fields and consent to a reply.", "error"); return;
    }
    const submit = $("#contactForm button[type='submit']"); submit.disabled = true; submit.textContent = "Sending…";
    try {
      const { error } = await db.from("contact_messages").insert(payload);
      if (error) throw error;
      form.reset();
      setFormStatus("#contactStatus", "Message received. The restaurant team can now follow up using your contact details.", "success");
      showToast("Message sent successfully.");
      window.setTimeout(() => closeDialog($("#contactDialog")), 2300);
    } catch (error) {
      console.error("Contact submission failed", error);
      setFormStatus("#contactStatus", "We could not send your message. Please try again or use the listed phone/email.", "error");
    } finally { submit.disabled = false; submit.innerHTML = 'Send message <span aria-hidden="true">↗</span>'; }
  }

  function setupFormSubmissions() {
    $("#reviewForm")?.addEventListener("submit", handleReviewSubmit);
    $("#contactForm")?.addEventListener("submit", handleContactSubmit);
  }

  function setupRealtime() {
    if (!backend.ready || !db?.channel) return;
    try {
      db.channel("four-flavours-public-content")
        .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => loadContent({ quiet: true }))
        .on("postgres_changes", { event: "*", schema: "public", table: "cuisine_sections" }, () => loadContent({ quiet: true }))
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => loadContent({ quiet: true }))
        .on("postgres_changes", { event: "*", schema: "public", table: "media_assets" }, () => loadContent({ quiet: true }))
        .subscribe(status => { if (status === "CHANNEL_ERROR") console.info("Supabase Realtime is not enabled for every website table; refresh-to-update still works."); });
    } catch (error) { console.info("Realtime subscription skipped.", error?.message || error); }
  }

  // Start with responsive UI immediately; then replace starter content with live database content.
  setupNavigation();
  setupDialogs();
  setupFormSubmissions();
  applySettings();
  renderCuisines(cuisines);
  renderReviews();
  currentGalleryFromDom();
  bindGalleryButtons();
  bindReviewButtons();
  loadContent();
  loadGoogleReviews();
  setupRealtime();
})();
