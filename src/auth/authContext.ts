import { createContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = { children: ReactNode };
