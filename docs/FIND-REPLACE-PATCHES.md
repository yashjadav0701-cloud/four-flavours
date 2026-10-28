# Four Flavours — manual patch notes

The recommended method is to extract the updated ZIP into a new folder and use that folder as the project, because several HTML/CSS/JS files and the SQL migration work together. If you need to patch an existing folder manually, use exact Find/Replace blocks below.

## Patch 1 — Replace the broken Chinese cuisine image URL

**Files:** `index.html` and `js/app.js`. The supplied master migration already seeds the repaired URL and intentionally retains the old URL only in its upgrade condition so existing broken database rows can be recognized and repaired.

### FIND
```text
https://images.unsplash.com/photo-1563247118-4e4d5e4c9d8d?auto=format&fit=crop&w=1000&q=85
```

### REPLACE WITH
```text
https://images.unsplash.com/photo-1760699609029-01bcc566ab50?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=85&w=1000
```

The updated `js/app.js` also retries a second image URL if the first one fails. A customer/admin can still replace it with a restaurant-owned image using the upload control.

## Patch 2 — Remove the cuisine image hover change

**File:** `css/styles.css`.

### FIND
```css
.cuisine-card__image img{transition:transform .9s var(--ease),filter .5s;filter:saturate(.88)}.cuisine-card:hover .cuisine-card__image img{transform:scale(1.055);filter:saturate(1.06)}
```

### REPLACE WITH
```css
.cuisine-card__image img{transition:none;filter:none}.cuisine-card:hover .cuisine-card__image img{transform:none;filter:none}
```

The updated `js/app.js` also no longer creates the corner glyph overlay on cuisine photographs.

## Patch 3 — Replace the former table-booking action with a phone call

**File:** `index.html`.

### FIND
```html
<div class="visit__actions reveal"><a class="button button--light" id="directionsLink" href="#" target="_blank" rel="noopener">Get directions <span aria-hidden="true">↗</span></a><a class="button button--outline button--on-dark" id="phoneLink" href="#visit">Call to book <span aria-hidden="true">↗</span></a></div>
```

### REPLACE WITH
```html
<div class="visit__actions reveal"><a class="button button--light" id="directionsLink" href="#" target="_blank" rel="noopener">Get directions <span aria-hidden="true">↗</span></a><a class="button button--outline button--on-dark" id="phoneLink" href="#visit">Call the restaurant <span aria-hidden="true">↗</span></a></div>
```

Also keep the updated phone link in the `CALL / SAY HELLO` details area of the updated ZIP: it uses `id="phoneNumberText"`. The JS populates both links from the `phone` value saved in Admin → Website & branding. Do not type a placeholder number; enter the real restaurant number in Supabase admin settings.

## Admin logo/icon and image upload controls

For these, replace the project files from the ZIP rather than attempting a partial manual edit: `admin.html`, `css/admin.css`, `js/admin.js`, `js/app.js`, `supabase/MASTER_MIGRATION.sql`, and `supabase/migrations/20261022000000_master.sql` were updated together. The logo, favicon, hero, story and cuisine upload controls need the database/storage bucket and RLS policies from the matching master migration.

## Patch 4 — Enable optional Google review fetching after setup

**File:** `js/config.js`. Do this only after deploying `supabase/functions/google-reviews` and setting the Google API key/Place ID secrets as described in `docs/GOOGLE-REVIEWS-GUIDE.md`.

### FIND
```js
googleReviewsEnabled: false // Set true only after deploying the optional google-reviews Edge Function.
```

### REPLACE WITH
```js
googleReviewsEnabled: true // Calls the deployed server-side Google Places proxy.
```

Never add the Google Places API key to `js/config.js`. The optional Google panel is separate from first-party reviews and attributes the reviews to Google Maps.


## Patch 5 — Keep the phone number usable in both contact links

**File:** `js/app.js`. Replace the entire function so the normalized number is in the shared function scope. The older version declared `digits` only inside the first link's `if` block; the visible phone-number link could then throw a `ReferenceError`.

### FIND
```js
  function setEmailAndPhone() {
    const phone = String(settings.phone || "").trim();
    const phoneLink = $("#phoneLink");
    if (phoneLink) {
      const digits = phone.replace(/[^+\d]/g, "");
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
```

### REPLACE WITH
```js
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
```

The updated ZIP already includes this fix. Use Patch 5 only when applying this correction manually to an older `js/app.js` file.
