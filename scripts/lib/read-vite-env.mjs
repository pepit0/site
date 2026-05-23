import fs from "node:fs";
import path from "node:path";

const ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

/**
 * @param {string} root
 * @param {string} key e.g. VITE_PUBLIC_SITE_URL
 */
export function readViteEnvVar(root, key) {
  for (const f of ENV_FILES) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const re = new RegExp(`^${key}\\s*=\\s*(.*)$`);
      const m = t.match(re);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) return v;
    }
  }
  return (process.env[key] ?? "").trim();
}

/**
 * @param {string} root
 */
export function loadViteBuildEnv(root) {
  const siteUrl = readViteEnvVar(root, "VITE_PUBLIC_SITE_URL").replace(/\/+$/, "");
  const supabaseUrl = readViteEnvVar(root, "VITE_SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = readViteEnvVar(root, "VITE_SUPABASE_ANON_KEY");
  return { siteUrl, supabaseUrl, supabaseAnonKey };
}
