import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchInventoryUnitsByIds, type ChatSuggestedUnit } from "../../lib/chatSuggestInventory";
import { buildUnitPickIds } from "../../lib/recentInventoryViews";
import { submitPublicChatLead } from "../../lib/submitChatLead";
import { openTawkHandoff } from "../../lib/tawkHandoff";
import { useTawkAgentStatus } from "../../hooks/useTawkAgentStatus";

type Step = "contact" | "loading" | "unitPick" | "handoff" | "handoffRetry" | "message" | "done";

const PHONE_DISPLAY = "(587) 741-1945";
const PHONE_TEL = "+15877411945";

function ChatIcon() {
  return (
    <svg className="site-chatFabIcon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"
      />
    </svg>
  );
}

function currentInventoryUnitId(pathname: string): string | null {
  const match = pathname.match(/^\/inventory\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

function unitPickLabel(u: ChatSuggestedUnit): string {
  return `${u.year} ${u.title} — Stock #${u.stock_number}`;
}

function stepTitle(step: Step): string {
  switch (step) {
    case "contact":
      return "We’re here to help";
    case "loading":
      return "One moment…";
    case "unitPick":
      return "Your recent units";
    case "handoff":
      return "Opening chat…";
    case "handoffRetry":
      return "Open live chat";
    case "message":
      return "How can we help?";
    case "done":
      return "Message sent";
    default:
      return "We’re here to help";
  }
}

function stepSubtitle(step: Step, tawkConfigured: boolean): string {
  switch (step) {
    case "contact":
      return tawkConfigured
        ? "Share your info, then continue in our chat."
        : "Leave your info and tell us what you’re looking for.";
    case "loading":
      return "Loading your recent views…";
    case "unitPick":
      return tawkConfigured
        ? "Did you have a specific unit in mind? We’ll open chat next."
        : "Did you have a specific unit in mind?";
    case "handoff":
      return "Connecting you to chat…";
    case "handoffRetry":
      return "Tap below to open our chat (you or our assistant will reply).";
    case "message":
      return "Anything we should know before we call you back?";
    case "done":
      return "Thanks — a team member will follow up soon.";
    default:
      return "";
  }
}

export function OfflineChatWidget() {
  const location = useLocation();
  const { isAgentOnline, tawkConfigured, tawkReady } = useTawkAgentStatus();
  const [handedOffToTawk, setHandedOffToTawk] = useState(false);
  /** Intake FAB: always when Tawk is set up; otherwise only when agents are away (no live Tawk). */
  const showIntakeWidget = !handedOffToTawk && (tawkConfigured || !isAgentOnline);

  const currentUnitId = useMemo(
    () => currentInventoryUnitId(location.pathname),
    [location.pathname]
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("contact");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickOptions, setPickOptions] = useState<ChatSuggestedUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<ChatSuggestedUnit | null>(null);
  const [skippedUnitPick, setSkippedUnitPick] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetFlow = useCallback((opts?: { keepHandoff?: boolean }) => {
    setStep("contact");
    setName("");
    setPhone("");
    setPickOptions([]);
    setSelectedUnit(null);
    setSkippedUnitPick(false);
    setMessage("");
    setError(null);
    setSubmitting(false);
    if (!opts?.keepHandoff) {
      setHandedOffToTawk(false);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    resetFlow();
  }, [resetFlow]);

  const loadUnitPick = async () => {
    setStep("loading");
    setError(null);
    try {
      const ids = buildUnitPickIds(currentUnitId);
      const units = await fetchInventoryUnitsByIds(ids);
      setPickOptions(units);
      setStep("unitPick");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStep("contact");
    }
  };

  const onContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (phone.trim().length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }
    void loadUnitPick();
  };

  const saveIntakeLead = (unit: ChatSuggestedUnit | null, skipped: boolean, note: string) => {
    const label = unit ? unitPickLabel(unit) : null;
    void submitPublicChatLead({
      displayName: name,
      phone,
      category: null,
      yearMin: null,
      yearMax: null,
      queryText: "",
      suggestedUnitIds: pickOptions.map((u) => u.id),
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      selectedUnitId: unit?.id ?? null,
      selectedUnitLabel: label,
      visitorMessage: note,
      skippedUnitPick: skipped
    });
  };

  const handoffToTawk = async (unit: ChatSuggestedUnit | null): Promise<boolean> => {
    const label = unit ? unitPickLabel(unit) : null;
    return openTawkHandoff({
      name,
      phone,
      unitLabel: label,
      unitId: unit?.id ?? null
    });
  };

  const continueAfterUnitPick = async (unit: ChatSuggestedUnit | null, skipped: boolean) => {
    setSelectedUnit(unit);
    setSkippedUnitPick(skipped);
    setError(null);

    if (!tawkConfigured) {
      setStep("message");
      return;
    }

    setStep("handoff");
    const label = unit ? unitPickLabel(unit) : null;
    saveIntakeLead(
      unit,
      skipped,
      unit
        ? `Handed off to Tawk — interested in: ${label}`
        : "Handed off to Tawk — no specific unit selected"
    );

    const opened = await handoffToTawk(unit);

    if (opened) {
      setHandedOffToTawk(true);
      setOpen(false);
      resetFlow({ keepHandoff: true });
      return;
    }

    setStep("handoffRetry");
  };

  const retryTawkHandoff = async () => {
    setError(null);
    setStep("handoff");
    const opened = await handoffToTawk(selectedUnit);
    if (opened) {
      setHandedOffToTawk(true);
      setOpen(false);
      resetFlow({ keepHandoff: true });
      return;
    }
    setError("Chat still isn’t ready. Refresh the page or call us below.");
    setStep("handoffRetry");
  };

  const onSelectUnit = (unit: ChatSuggestedUnit) => {
    void continueAfterUnitPick(unit, false);
  };

  const onNotReally = () => {
    void continueAfterUnitPick(null, true);
  };

  const onMessageSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError("Please enter a short message (at least 3 characters).");
      return;
    }
    setSubmitting(true);
    const save = await submitPublicChatLead({
      displayName: name,
      phone,
      category: null,
      yearMin: null,
      yearMax: null,
      queryText: "",
      suggestedUnitIds: pickOptions.map((u) => u.id),
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      selectedUnitId: selectedUnit?.id ?? null,
      selectedUnitLabel: selectedUnit ? unitPickLabel(selectedUnit) : null,
      visitorMessage: trimmed,
      skippedUnitPick
    });
    setSubmitting(false);
    if (!save.ok) {
      setError(save.error);
      return;
    }
    setStep("done");
  };

  const preApprovalHref = selectedUnit
    ? `/pre-approval?unit=${encodeURIComponent(selectedUnit.id)}`
    : "/pre-approval";

  if (!showIntakeWidget) {
    return null;
  }

  return (
    <div
      className="site-chat"
      data-tawk-configured={tawkConfigured ? "true" : "false"}
      data-tawk-ready={tawkReady ? "true" : "false"}
    >
      {open ? (
        <div
          className="site-chatPanel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-chat-title"
        >
          <header className="site-chatPanelHero">
            <div className="site-chatPanelHeroText">
              <p className="site-chatPanelEyebrow">Temptation Motorsports</p>
              <h2 id="site-chat-title" className="site-chatPanelTitle">
                {stepTitle(step)}
              </h2>
              <p className="site-chatPanelSubtitle">{stepSubtitle(step, tawkConfigured)}</p>
            </div>
            <button type="button" className="site-chatClose" onClick={close} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="site-chatPanelBody">
            {step === "contact" ? (
              <form className="site-chatForm" onSubmit={onContactSubmit}>
                <div className="site-chatField">
                  <label className="site-chatLabel" htmlFor="chat-name">
                    Your name
                  </label>
                  <input
                    id="chat-name"
                    className="site-chatInput"
                    placeholder="First and last"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="site-chatField">
                  <label className="site-chatLabel" htmlFor="chat-phone">
                    Phone number
                  </label>
                  <input
                    id="chat-phone"
                    className="site-chatInput"
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                </div>
                {error ? (
                  <p className="site-chatError" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="btn btn-primary site-chatSubmitBtn">
                  Continue
                </button>
                <p className="site-chatFinePrint">
                  Availability subject to confirmation. No obligation to apply.
                </p>
              </form>
            ) : null}

            {step === "loading" || step === "handoff" ? (
              <div className="site-chatLoading" role="status" aria-live="polite">
                <span className="site-chatSpinner" aria-hidden />
                <p>{step === "handoff" ? "Opening live chat…" : "Loading…"}</p>
              </div>
            ) : null}

            {step === "unitPick" ? (
              <div className="site-chatUnitPick">
                {pickOptions.length > 0 ? (
                  <ul className="site-chatUnitList">
                    {pickOptions.map((u) => (
                      <li key={u.id}>
                        <button type="button" className="site-chatUnitCard site-chatUnitPickBtn" onClick={() => onSelectUnit(u)}>
                          <span className="site-chatUnitCategory">{u.category}</span>
                          <span className="site-chatUnitTitle">
                            {u.year} {u.title}
                          </span>
                          <span className="site-chatUnitMeta">
                            {u.yearKm} · Stock #{u.stock_number}
                          </span>
                          {tawkConfigured ? <span className="site-chatUnitCta">Continue to chat →</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button type="button" className="btn btn-secondary site-chatNotReallyBtn" onClick={onNotReally}>
                  {tawkConfigured ? "No specific unit — continue to chat" : "Not really"}
                </button>
              </div>
            ) : null}

            {step === "handoffRetry" ? (
              <div className="site-chatHandoffRetry">
                {selectedUnit ? (
                  <p className="site-chatSelectedUnit" role="status">
                    <span className="site-chatSelectedUnitLabel">Unit:</span> {unitPickLabel(selectedUnit)}
                  </p>
                ) : null}
                {error ? (
                  <p className="site-chatError" role="alert">
                    {error}
                  </p>
                ) : null}
                {!tawkReady ? (
                  <p className="site-chatMuted">Loading chat… one moment, then tap the button below.</p>
                ) : null}
                <button type="button" className="btn btn-primary site-chatSubmitBtn" onClick={() => void retryTawkHandoff()}>
                  Open live chat
                </button>
                <a href={`tel:${PHONE_TEL}`} className="btn btn-secondary site-chatSecondaryBtn">
                  Call / text {PHONE_DISPLAY}
                </a>
                <button type="button" className="site-chatTextBtn" onClick={() => setStep("unitPick")}>
                  Back
                </button>
              </div>
            ) : null}

            {step === "message" && !tawkConfigured ? (
              <form className="site-chatForm" onSubmit={onMessageSubmit}>
                {selectedUnit ? (
                  <p className="site-chatSelectedUnit" role="status">
                    <span className="site-chatSelectedUnitLabel">Unit:</span> {unitPickLabel(selectedUnit)}
                  </p>
                ) : null}
                <div className="site-chatField">
                  <label className="site-chatLabel" htmlFor="chat-message">
                    Your message
                  </label>
                  <textarea
                    id="chat-message"
                    className="site-chatTextarea"
                    rows={4}
                    placeholder="Questions about financing, availability, trade-in…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={3}
                  />
                </div>
                {error ? (
                  <p className="site-chatError" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="btn btn-primary site-chatSubmitBtn" disabled={submitting}>
                  {submitting ? "Sending…" : "Send message"}
                </button>
                <button
                  type="button"
                  className="site-chatTextBtn"
                  onClick={() => setStep("unitPick")}
                  disabled={submitting}
                >
                  Back
                </button>
              </form>
            ) : null}

            {step === "done" ? (
              <div className="site-chatDone">
                <p className="site-chatDoneLead">We got your message and will reach out at the number you provided.</p>
                <div className="site-chatResultsFooter">
                  <p className="site-chatCtaLead">Ready for financing?</p>
                  <Link to={preApprovalHref} className="btn btn-primary site-chatSubmitBtn site-chatCtaBtn" onClick={close}>
                    Get pre-approved
                  </Link>
                  <a href={`tel:${PHONE_TEL}`} className="btn btn-secondary site-chatSecondaryBtn">
                    Call / text {PHONE_DISPLAY}
                  </a>
                  <Link to="/inventory" className="site-chatLink site-chatDoneBrowse" onClick={close}>
                    Browse inventory
                  </Link>
                  <button type="button" className="site-chatTextBtn" onClick={() => resetFlow()}>
                    Start over
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!open ? (
        <p className="site-chatFabTeaser" aria-hidden>
          <span className="site-chatFabTeaserLine">Questions?</span>
          <span className="site-chatFabTeaserLine site-chatFabTeaserAccent">Chat with us</span>
        </p>
      ) : null}

      <button
        type="button"
        className={`site-chatFab${open ? " site-chatFabOpen" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-chat-title"
      >
        <span className="site-chatFabPulse" aria-hidden />
        <span className="site-chatFabInner">
          <ChatIcon />
          <span className="site-chatFabLabel">{open ? "Close" : "Chat"}</span>
        </span>
      </button>
    </div>
  );
}
