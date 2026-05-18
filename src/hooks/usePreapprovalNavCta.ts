import { useSyncExternalStore } from "react";
import { PREAPPROVAL_NAV_CTA } from "../data/preapprovalCopy";
import {
  hasResumablePreapprovalDraft,
  PREAPPROVAL_DRAFT_CHANGED_EVENT
} from "../lib/preapprovalDraft";

function subscribe(onStoreChange: () => void): () => void {
  const onCustom = () => onStoreChange();
  window.addEventListener(PREAPPROVAL_DRAFT_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onCustom);
  return () => {
    window.removeEventListener(PREAPPROVAL_DRAFT_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onCustom);
  };
}

function getSnapshot(): boolean {
  return hasResumablePreapprovalDraft();
}

function getServerSnapshot(): boolean {
  return false;
}

export function usePreapprovalNavCta(): { label: string; hasResumeDraft: boolean } {
  const hasResumeDraft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    hasResumeDraft,
    label: hasResumeDraft ? PREAPPROVAL_NAV_CTA.resume : PREAPPROVAL_NAV_CTA.default
  };
}
