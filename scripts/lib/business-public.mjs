import { readViteEnvVar } from "./read-vite-env.mjs";

/** Build-time business profile (keep NAP fields in sync with src/lib/businessPublic.ts). */
export function loadPublicBusinessProfile(root) {
  const latRaw = readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_GEO_LAT");
  const lngRaw = readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_GEO_LNG");
  let geo;
  if (latRaw && lngRaw) {
    const latitude = Number.parseFloat(latRaw);
    const longitude = Number.parseFloat(lngRaw);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      geo = { latitude, longitude };
    }
  }

  const sameAsRaw = readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_SAME_AS");
  const sameAs = sameAsRaw
    ? sameAsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    name: "Temptation Motorsports",
    phoneDisplay: "(587) 205-5773",
    phoneTel: "+15872055773",
    email: "temptationmotorsports@gmail.com",
    streetAddress: readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_STREET_ADDRESS") || undefined,
    city: "Sherwood Park",
    regionCode: "AB",
    postalCode: readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_POSTAL_CODE") || undefined,
    country: "Canada",
    googleMapsUrl: readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_GOOGLE_MAPS_URL") || undefined,
    hoursLabel: readViteEnvVar(root, "VITE_PUBLIC_BUSINESS_HOURS") || undefined,
    sameAs,
    geo
  };
}

export function formatAddressLines(profile) {
  const cityLine = [profile.city, profile.regionCode, profile.postalCode].filter(Boolean).join(", ");
  return [profile.streetAddress, cityLine, profile.country].filter(Boolean);
}

export function buildOrganizationJsonLd(profile, { pageUrl, description, types = ["Organization"] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": types.length === 1 ? types[0] : types,
    name: profile.name,
    telephone: profile.phoneTel,
    email: profile.email,
    url: pageUrl,
    ...(description ? { description } : {}),
    address: {
      "@type": "PostalAddress",
      ...(profile.streetAddress ? { streetAddress: profile.streetAddress } : {}),
      addressLocality: profile.city,
      addressRegion: profile.regionCode,
      addressCountry: "CA",
      ...(profile.postalCode ? { postalCode: profile.postalCode } : {})
    },
    areaServed: { "@type": "Country", name: profile.country }
  };

  if (profile.hoursLabel) jsonLd.openingHours = profile.hoursLabel;
  if (profile.geo) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: profile.geo.latitude,
      longitude: profile.geo.longitude
    };
  }
  if (profile.sameAs.length > 0) jsonLd.sameAs = profile.sameAs;
  if (profile.googleMapsUrl) jsonLd.hasMap = profile.googleMapsUrl;

  return jsonLd;
}
