import { useTawkContext, type TawkAgentStatus } from "../components/chat/tawkContext";
import { isTawkConfigured } from "../lib/tawkConfig";

export type { TawkAgentStatus };

/** True when live Tawk chat should be shown (agent online). */
export function useTawkAgentStatus(): {
  status: TawkAgentStatus;
  isAgentOnline: boolean;
  tawkConfigured: boolean;
  tawkReady: boolean;
} {
  const { status, tawkReady } = useTawkContext();
  const tawkConfigured = isTawkConfigured();
  const isAgentOnline = tawkConfigured && status === "online";
  return { status, isAgentOnline, tawkConfigured, tawkReady };
}
