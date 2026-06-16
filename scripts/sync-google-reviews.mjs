/**
 * Sync src/data/google-reviews.json from the Temptation Motorsports Google Business Profile.
 *
 * Requires:
 *   GOOGLE_PLACES_API_KEY — server-side key with Places API (New) enabled
 *   GOOGLE_PLACE_ID       — optional Temptation Motorsports Place ID (ChIJ…)
 *                           If omitted, looks up "Temptation Motorsports" via Text Search
 *   VITE_PUBLIC_BUSINESS_GOOGLE_MAPS_URL — your Google share/maps link (also used for on-site buttons)
 *
 * Usage:
 *   npm run google-reviews:sync
 *
 * Google returns up to 5 reviews per request.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readViteEnvVar } from "./lib/read-vite-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const MAX_STORED_REVIEWS = 12;
const TEXT_SEARCH_QUERY = "Temptation Motorsports Alberta Canada";

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

function extractPlaceIdFromMapsUrl(mapsUrl) {
  if (!mapsUrl) return undefined;

  const placeIdParam = mapsUrl.match(/[?&]place_id=(ChIJ[A-Za-z0-9_-]+)/i);
  if (placeIdParam?.[1]) return placeIdParam[1];

  const embeddedPlaceId = mapsUrl.match(/!1s(ChIJ[A-Za-z0-9_-]+)/i);
  if (embeddedPlaceId?.[1]) return embeddedPlaceId[1];

  return undefined;
}

function normalizePlaceId(rawId) {
  if (!rawId) return undefined;
  return rawId.replace(/^places\//, "").trim();
}

async function findPlaceIdViaTextSearch(apiKey, textQuery = TEXT_SEARCH_QUERY) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName"
    },
    body: JSON.stringify({ textQuery })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places Text Search ${response.status}: ${body}`);
  }

  const data = await response.json();
  const places = data.places ?? [];
  const match =
    places.find((place) => /temptation/i.test(place.displayName?.text ?? "")) ?? places[0];

  return normalizePlaceId(match?.id);
}

async function resolvePlaceId(projectRoot, apiKey) {
  const explicit =
    process.env.GOOGLE_PLACE_ID?.trim() ||
    readViteEnvVar(projectRoot, "GOOGLE_PLACE_ID") ||
    extractPlaceIdFromMapsUrl(readViteEnvVar(projectRoot, "VITE_PUBLIC_BUSINESS_GOOGLE_MAPS_URL"));

  if (explicit) return normalizePlaceId(explicit);
  if (!apiKey) return undefined;

  return findPlaceIdViaTextSearch(apiKey);
}

function normalizeReview(review) {
  const text = review.text?.trim() ?? "";
  const publishedAt = review.publishedAt?.trim();
  const relativeTime = review.relativeTime?.trim();

  return {
    id:
      review.id?.trim() ||
      slugify(`${review.authorName}-${publishedAt || relativeTime || text.slice(0, 24)}`),
    authorName: review.authorName?.trim() || "Google reviewer",
    rating: Number(review.rating) || 5,
    text,
    ...(publishedAt ? { publishedAt } : {}),
    ...(relativeTime ? { relativeTime } : {})
  };
}

function mapGoogleReview(review) {
  const authorName = review.authorAttribution?.displayName?.trim() || "Google reviewer";
  const text = (review.text?.text || review.originalText?.text || "").trim();
  const publishedAt = review.publishTime?.slice(0, 10);

  return normalizeReview({
    id: slugify(`${authorName}-${publishedAt || text.slice(0, 24)}`),
    authorName,
    rating: review.rating ?? 5,
    text,
    publishedAt,
    relativeTime: review.relativePublishTimeDescription?.trim()
  });
}

function dedupeReviews(reviews) {
  const seen = new Set();
  const output = [];

  for (const review of reviews) {
    if (!review.text) continue;
    const key = review.text.slice(0, 96).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(review);
  }

  return output;
}

export async function syncGoogleReviews(projectRoot = root, { dryRun = false } = {}) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY?.trim() || readViteEnvVar(projectRoot, "GOOGLE_PLACES_API_KEY");
  const outPath = path.join(projectRoot, "src", "data", "google-reviews.json");

  if (!apiKey) {
    console.warn(
      "[google-reviews:sync] GOOGLE_PLACES_API_KEY not set — skipping API fetch. " +
        "Add the key to .env.local and run npm run google-reviews:sync."
    );
    return { skipped: true, reason: "missing_api_key" };
  }

  const placeId = await resolvePlaceId(projectRoot, apiKey);

  if (!placeId) {
    console.warn(
      "[google-reviews:sync] Could not resolve Temptation Motorsports Place ID. " +
        "Set GOOGLE_PLACE_ID in .env.local or verify your Google listing name."
    );
    return { skipped: true, reason: "missing_place_id" };
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Places API ${response.status}: ${body}`);
  }

  const data = await response.json();
  const displayName = data.displayName?.text?.trim() ?? "";
  if (displayName && !/temptation/i.test(displayName)) {
    throw new Error(
      `Refusing to sync reviews for "${displayName}" — expected Temptation Motorsports. ` +
        "Set GOOGLE_PLACE_ID to your listing's Place ID."
    );
  }

  const apiReviews = (data.reviews ?? []).map(mapGoogleReview).filter((review) => review.text.length > 0);

  const summary = {
    ratingValue: data.rating ?? 0,
    reviewCount: data.userRatingCount ?? 0,
    sourceLabel: "Google"
  };

  const reviews = dedupeReviews(apiReviews).slice(0, MAX_STORED_REVIEWS);
  const output = { summary, reviews };

  if (!dryRun) {
    fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }

  console.log(
    `[google-reviews:sync] ${displayName || placeId}: ${summary.ratingValue}★ from ${summary.reviewCount} Google reviews — stored ${reviews.length} review(s)`
  );

  return output;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  syncGoogleReviews().catch((error) => {
    console.error(`[google-reviews:sync] ${error.message}`);
    process.exit(1);
  });
}
