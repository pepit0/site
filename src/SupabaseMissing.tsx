export function SupabaseMissing() {
  return (
    <div className="env-missing">
      <h1 className="env-missingTitle">Configuration needed</h1>
      <p className="env-missingBody">
        This app needs Supabase environment variables before it can run. For local dev, in the{" "}
        <code className="env-missingCode">site</code> folder copy <code className="env-missingCode">.env.example</code> to{" "}
        <code className="env-missingCode">.env.local</code> and set the values below, then restart{" "}
        <code className="env-missingCode">npm run dev</code>. On Vercel, add the same names under Project → Settings →
        Environment Variables (Production), then redeploy.
      </p>
      <ul className="env-missingList">
        <li>
          <code className="env-missingCode">VITE_SUPABASE_URL</code>
        </li>
        <li>
          <code className="env-missingCode">VITE_SUPABASE_ANON_KEY</code>
        </li>
      </ul>
      <p className="env-missingBody">
        Use your marketing Supabase project (Supabase → Settings → API). Use the <strong>anon</strong> or publishable key, not
        the service role key. If this site uses its own project, also set{" "}
        <code className="env-missingCode">VITE_SITE_MARKETING_ONLY=true</code> (see <code className="env-missingCode">.env.example</code>
        ).
      </p>
    </div>
  );
}
