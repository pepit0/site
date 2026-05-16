import { useAuth } from "../auth/useAuth";
import { Seo } from "../seo/Seo";

const crmAppUrl = import.meta.env.VITE_CRM_APP_URL;

export function StaffPage() {
  const { user } = useAuth();
  const email = user?.email ?? "Signed in";

  return (
    <div className="staff">
      <Seo title="Staff" description="Staff sign-in hub for Temptation Motorsports." path="/staff" noindex />
      <header className="page-header">
        <h1 className="page-title">Staff</h1>
        <p className="page-subtitle">
          Signed in as {email}. This account is the same Supabase user as the finance CRM—use the same email and
          password on both apps. Open the full CRM for day-to-day work.
        </p>
      </header>
      <div className="staff-actions">
        {crmAppUrl ? (
          <a className="btn btn-primary" href={crmAppUrl} rel="noreferrer">
            Open finance CRM
          </a>
        ) : (
          <p className="page-subtitle">
            Set <code className="staff-code">VITE_CRM_APP_URL</code> in <code className="staff-code">.env.local</code>{" "}
            to show a shortcut to the CRM app.
          </p>
        )}
      </div>
    </div>
  );
}
