import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";
import App from "./App.tsx";
import { isSupabaseConfigured } from "./lib/supabase";
import { SupabaseMissing } from "./SupabaseMissing";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isSupabaseConfigured() ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SupabaseMissing />
    )}
  </StrictMode>
);
