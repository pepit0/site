const BUTTON_ID = "tm-comp-capture-btn";
const TOAST_ID = "tm-comp-capture-toast";

function parseCadPrice(text) {
  const match = String(text || "").match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const n = Number.parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function extractItemId(url) {
  const match = String(url || "").match(/\/marketplace\/item\/(\d+)/i);
  return match ? match[1] : null;
}

function parseAriaLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return { title: "", priceText: null, locationText: null };

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && parts[1].includes("$")) {
    return {
      title: parts[0],
      priceText: parts[1],
      locationText: parts.slice(2).join(", ")
    };
  }
  if (parts.length >= 2 && parts[0].includes("$")) {
    return {
      title: parts.slice(1).join(", ") || parts[0],
      priceText: parts[0],
      locationText: null
    };
  }
  return { title: raw, priceText: null, locationText: null };
}

function scrapeVisibleListings() {
  const seen = new Set();
  const listings = [];

  document.querySelectorAll('a[href*="/marketplace/item/"]').forEach((anchor) => {
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const listingUrl = anchor.href.split("?")[0];
    if (!listingUrl || seen.has(listingUrl)) return;
    seen.add(listingUrl);

    const aria = parseAriaLabel(anchor.getAttribute("aria-label") || anchor.textContent || "");
    let title = aria.title;
    let priceText = aria.priceText;
    let locationText = aria.locationText;

    const card =
      anchor.closest('[data-testid="marketplace-feed-item"]') ||
      anchor.closest('[role="article"]') ||
      anchor.parentElement;

    if (card) {
      const text = card.textContent || "";
      if (!priceText) {
        const priceMatch = text.match(/\$\s*[\d,]+(?:\.\d{2})?/);
        if (priceMatch) priceText = priceMatch[0];
      }
      if (!title || title.length < 3) {
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        title = lines.find((l) => !l.startsWith("$") && l.length > 3) || title;
      }
    }

    if (!title) title = "Marketplace listing";

    const image = card?.querySelector("img");
    const imageUrl = image instanceof HTMLImageElement ? image.src : null;

    listings.push({
      title,
      listingUrl,
      priceText,
      priceCad: parseCadPrice(priceText || ""),
      locationText,
      imageUrl,
      postedLabel: null,
      fbItemId: extractItemId(listingUrl)
    });
  });

  return listings;
}

function showToast(message) {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  window.setTimeout(() => {
    if (toast && toast.parentElement) toast.remove();
  }, 5000);
}

function ensureButton() {
  if (document.getElementById(BUTTON_ID)) return;
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.textContent = "Capture visible listings";
  btn.addEventListener("click", () => void captureAndSend(btn));
  document.body.appendChild(btn);
}

async function captureAndSend(btn) {
  btn.disabled = true;
  try {
    const settings = await chrome.storage.sync.get(["apiBase", "apiKey", "searchId"]);
    const apiBase = String(settings.apiBase || "").replace(/\/+$/, "");
    const apiKey = String(settings.apiKey || "");
    const searchId = String(settings.searchId || "");

    if (!apiBase || !apiKey || !searchId) {
      showToast("Open the extension popup and save API base, key, and search ID.");
      return;
    }

    const listings = scrapeVisibleListings();
    if (listings.length === 0) {
      showToast("No listings found on screen. Scroll the search results and try again.");
      return;
    }

    const res = await fetch(`${apiBase}/api/extension/marketplace-comps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ searchId, listings })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(payload.error || `Upload failed (${res.status})`);
      return;
    }

    showToast(`Saved ${payload.saved ?? listings.length} listing(s). Refresh the admin page.`);
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Capture failed");
  } finally {
    btn.disabled = false;
  }
}

ensureButton();
