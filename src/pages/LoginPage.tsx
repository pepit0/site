import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { isMarketingOnlySite } from "../siteMode";

function safeRedirectPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = safeRedirectPath(searchParams.get("from"));
  const defaultAfterLogin = isMarketingOnlySite() ? "/admin/inventory" : "/staff";

  useEffect(() => {
    if (isLoading || !user) return;
    navigate(from ?? defaultAfterLogin, { replace: true });
  }, [defaultAfterLogin, from, isLoading, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    const error = await signInWithPassword(email.trim(), password);
    if (error) {
      setErrorMessage(error);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <p className="auth-loadingText">Loading…</p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="loginScreen" role="main" aria-label="Sign in">
      <div className="loginScreenInner">
        <header className="loginScreenHeader">
          <h1 className="loginScreenTitle">{isMarketingOnlySite() ? "Admin sign in" : "Staff sign in"}</h1>
          <p className="loginScreenSubtitle">
            {isMarketingOnlySite()
              ? "Use the Supabase account created for inventory admins."
              : "Use the same account as the finance CRM."}
          </p>
        </header>
        <form className="loginForm" onSubmit={handleSubmit}>
          <label className="loginLabel" htmlFor="site-login-email">
            Email
          </label>
          <input
            id="site-login-email"
            className="loginInput"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label className="loginLabel" htmlFor="site-login-password">
            Password
          </label>
          <input
            id="site-login-password"
            className="loginInput"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {errorMessage ? (
            <p className="loginError" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button className="loginButton btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
