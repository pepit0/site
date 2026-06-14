import { openSiteChat } from "../lib/siteChatOpen";

type InventoryMessageUsLinkProps = {
  className?: string;
  label?: string;
  ariaLabel?: string;
};

export function InventoryMessageUsLink({
  className,
  label = "or message us",
  ariaLabel = "Or send us a message — open chat"
}: InventoryMessageUsLinkProps) {
  return (
    <button
      type="button"
      className={`inventory-messageUs${className ? ` ${className}` : ""}`}
      onClick={() => openSiteChat()}
      aria-label={ariaLabel}
    >
      <svg className="inventory-messageUsIcon" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
