import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";
import App from "./App.tsx";
import { removePrerenderFallback } from "./lib/removePrerenderFallback";
import { isSupabaseConfigured } from "./lib/supabase";
import { SupabaseMissing } from "./SupabaseMissing";

removePrerenderFallback();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isSupabaseConfigured() ? (
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    ) : (
      <SupabaseMissing />
    )}
  </StrictMode>
);
