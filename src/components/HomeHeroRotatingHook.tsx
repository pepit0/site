import { useEffect, useState } from "react";
import { HOME_PREVIEW_HERO } from "../data/homePreviewHeroCopy";

const ROTATE_MS = 5200;

export function HomeHeroRotatingHook() {
  const { hookLeads, hookRest } = HOME_PREVIEW_HERO;
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || hookLeads.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % hookLeads.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [hookLeads.length, reduceMotion]);

  const activeLead = hookLeads[activeIndex] ?? hookLeads[0];

  return (
    <>
      <span className="home-previewHookLeadWrap" aria-live="polite" aria-atomic="true">
        <span key={activeLead} className="home-previewHookLead">
          {activeLead}
        </span>
      </span>
      <span className="home-previewHookRest">{hookRest}</span>
    </>
  );
}
