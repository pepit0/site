/** Public business facts for NAP consistency (must match Google Business Profile when set). */

import { SITE_CONTACT } from "../data/preapprovalCopy";

export const BUSINESS_NAME = "Temptation Motorsports";

export const BUSINESS_LOCATION_DEFAULTS = {
  city: "Sherwood Park",
  region: "Alberta",
  regionCode: "AB",
  country: "Canada",
  areaLabel: "Sherwood Park, Alberta (Edmonton area)"
} as const;

export type PublicBusinessProfile = {
  name: string;
  phoneDisplay: string;
  phoneTel: string;
  email: string;
  streetAddress?: string;
  city: string;
  region: string;
  regionCode: string;
  postalCode?: string;
  country: string;
  areaLabel: string;
  googleMapsUrl?: string;
  hoursLabel?: string;
  sameAs: string[];
  geo?: { latitude: number; longitude: number };
};

function readEnv(key: string): string | undefined {
  const v = (import.meta.env[key as keyof ImportMetaEnv] as string | undefined)?.trim();
  return v || undefined;
}

export function optionalBusinessStreetAddress(): string | undefined {
  return readEnv("VITE_PUBLIC_BUSINESS_STREET_ADDRESS");
}

export function optionalBusinessPostalCode(): string | undefined {
  return readEnv("VITE_PUBLIC_BUSINESS_POSTAL_CODE");
}

export function optionalGoogleMapsUrl(): string | undefined {
  return readEnv("VITE_PUBLIC_BUSINESS_GOOGLE_MAPS_URL");
}

export function optionalBusinessHoursLabel(): string | undefined {
  return readEnv("VITE_PUBLIC_BUSINESS_HOURS");
}

export function optionalBusinessGeo(): { latitude: number; longitude: number } | undefined {
  const latRaw = readEnv("VITE_PUBLIC_BUSINESS_GEO_LAT");
  const lngRaw = readEnv("VITE_PUBLIC_BUSINESS_GEO_LNG");
  if (!latRaw || !lngRaw) return undefined;
  const latitude = Number.parseFloat(latRaw);
  const longitude = Number.parseFloat(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { latitude, longitude };
}

/** Comma-separated profile URLs (Facebook, Maps listing, etc.). */
export function optionalSameAsUrls(): string[] {
  const raw = readEnv("VITE_PUBLIC_BUSINESS_SAME_AS") ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function getPublicBusinessProfile(): PublicBusinessProfile {
  const streetAddress = optionalBusinessStreetAddress();
  const postalCode = optionalBusinessPostalCode();
  const googleMapsUrl = optionalGoogleMapsUrl();
  const hoursLabel = optionalBusinessHoursLabel();
  const sameAs = optionalSameAsUrls();
  const geo = optionalBusinessGeo();

  return {
    name: BUSINESS_NAME,
    phoneDisplay: SITE_CONTACT.phoneDisplay,
    phoneTel: SITE_CONTACT.phoneTel,
    email: SITE_CONTACT.email,
    streetAddress,
    city: BUSINESS_LOCATION_DEFAULTS.city,
    region: BUSINESS_LOCATION_DEFAULTS.region,
    regionCode: BUSINESS_LOCATION_DEFAULTS.regionCode,
    postalCode,
    country: BUSINESS_LOCATION_DEFAULTS.country,
    areaLabel: streetAddress
      ? `${streetAddress}, ${BUSINESS_LOCATION_DEFAULTS.city}, ${BUSINESS_LOCATION_DEFAULTS.regionCode}${postalCode ? ` ${postalCode}` : ""}`
      : BUSINESS_LOCATION_DEFAULTS.areaLabel,
    googleMapsUrl,
    hoursLabel,
    sameAs,
    geo
  };
}

export function formatBusinessAddressLines(profile: PublicBusinessProfile): string[] {
  const cityLine = [profile.city, profile.regionCode, profile.postalCode].filter(Boolean).join(", ");
  return [profile.streetAddress, cityLine, profile.country].filter(Boolean) as string[];
}

export function formatBusinessAddressOneLine(profile: PublicBusinessProfile): string {
  return profile.streetAddress
    ? formatBusinessAddressLines(profile).slice(0, 2).join(", ")
    : profile.areaLabel;
}

type OrganizationSchemaOptions = {
  pageUrl?: string;
  description?: string;
  types?: string[];
};

/** Shared Organization / LocalBusiness JSON-LD for NAP + GEO consistency. */
export function buildOrganizationJsonLd(
  profile: PublicBusinessProfile,
  options: OrganizationSchemaOptions = {}
): Record<string, unknown> {
  const types = options.types ?? ["Organization", "AutomotiveBusiness"];
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": types.length === 1 ? types[0] : types,
    name: profile.name,
    telephone: profile.phoneTel,
    email: profile.email,
    url: options.pageUrl,
    ...(options.description ? { description: options.description } : {}),
    address: {
      "@type": "PostalAddress",
      ...(profile.streetAddress ? { streetAddress: profile.streetAddress } : {}),
      addressLocality: profile.city,
      addressRegion: profile.regionCode,
      addressCountry: "CA",
      ...(profile.postalCode ? { postalCode: profile.postalCode } : {})
    },
    areaServed: {
      "@type": "Country",
      name: profile.country
    }
  };

  if (profile.hoursLabel) {
    jsonLd.openingHours = profile.hoursLabel;
  }

  if (profile.geo) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: profile.geo.latitude,
      longitude: profile.geo.longitude
    };
  }

  if (profile.sameAs.length > 0) {
    jsonLd.sameAs = profile.sameAs;
  }

  if (profile.googleMapsUrl) {
    jsonLd.hasMap = profile.googleMapsUrl;
  }

  return jsonLd;
}
