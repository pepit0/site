import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchUserHasCrmAccess } from "../lib/crmAccess";
import { fetchUserCanManageInventory } from "../lib/inventoryAdminAccess";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  /** When true, requires `user_has_crm_access` RPC (finance CRM staff). */
  requireCrm?: boolean;
  /** When true, requires `user_can_manage_inventory` RPC (marketing inventory admins). */
  requireInventoryAdmin?: boolean;
};

type CrmGateProps = {
  userId: string;
  children: ReactNode;
};

function CrmAccessGate({ userId, children }: CrmGateProps) {
  const [allowed, setAllowed] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchUserHasCrmAccess(supabase).then(({ allowed: ok, rpcError: err }) => {
      if (cancelled) return;
      setAllowed(ok);
      setRpcError(err);
      setIsPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isPending) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <p className="auth-loadingText">Checking access…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="staff-denied card card-pad">
        <h2 className="page-title">No staff access</h2>
        <p className="page-subtitle">
          You are signed in, but this account does not have CRM permissions. If you believe this is a mistake, ask an
          administrator to grant access.
        </p>
        {rpcError ? (
          <p className="staff-deniedRpc" role="status">
            Technical detail: {rpcError}
          </p>
        ) : null}
      </div>
    );
  }

  return children;
}

type InventoryAdminGateProps = {
  userId: string;
  children: ReactNode;
};

function InventoryAdminGate({ userId, children }: InventoryAdminGateProps) {
  const [allowed, setAllowed] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchUserCanManageInventory(supabase).then(({ allowed: ok, rpcError: err }) => {
      if (cancelled) return;
      setAllowed(ok);
      setRpcError(err);
      setIsPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isPending) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <p className="auth-loadingText">Checking access…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="staff-denied card card-pad">
        <h2 className="page-title">No admin access</h2>
        <p className="page-subtitle">
          You are signed in, but this account is not allowed to manage inventory. Ask an administrator to add your
          user ID to <code className="staff-code">inventory_admins</code> in Supabase.
        </p>
        {rpcError ? (
          <p className="staff-deniedRpc" role="status">
            Technical detail: {rpcError}
          </p>
        ) : null}
      </div>
    );
  }

  return children;
}

export function ProtectedRoute({
  children,
  requireCrm = true,
  requireInventoryAdmin = false
}: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <p className="auth-loadingText">Loading…</p>
      </div>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (requireInventoryAdmin) {
    return (
      <InventoryAdminGate key={user.id} userId={user.id}>
        {children}
      </InventoryAdminGate>
    );
  }

  if (requireCrm) {
    return (
      <CrmAccessGate key={user.id} userId={user.id}>
        {children}
      </CrmAccessGate>
    );
  }

  return children;
}
