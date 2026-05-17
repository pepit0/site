import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TawkAgentStatus = "online" | "away" | "offline" | "unknown";

type TawkContextValue = {
  status: TawkAgentStatus;
  setStatus: (status: TawkAgentStatus) => void;
  tawkReady: boolean;
  setTawkReady: (ready: boolean) => void;
};

const TawkContext = createContext<TawkContextValue | null>(null);

export function TawkProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TawkAgentStatus>("unknown");
  const [tawkReady, setTawkReady] = useState(false);
  const value = useMemo(
    () => ({ status, setStatus, tawkReady, setTawkReady }),
    [status, tawkReady]
  );
  return <TawkContext.Provider value={value}>{children}</TawkContext.Provider>;
}

export function useTawkContext(): TawkContextValue {
  const ctx = useContext(TawkContext);
  if (!ctx) {
    throw new Error("useTawkContext must be used within TawkProvider");
  }
  return ctx;
}
