/** Inline spinner + label for admin buttons during async work. */
export function AdminButtonBusyLabel({ children }: { children: string }) {
  return (
    <span className="admin-btnBusy">
      <span className="admin-btnSpinner" aria-hidden />
      <span>{children}</span>
    </span>
  );
}
