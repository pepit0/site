/**
 * Set `VITE_SITE_MARKETING_ONLY=true` in `.env.local` when this app uses a **separate** Supabase project from the
 * finance CRM. That hides Staff / Sign in (CRM RPCs and users are not on this project).
 */
export function isMarketingOnlySite(): boolean {
  return import.meta.env.VITE_SITE_MARKETING_ONLY === "true";
}
