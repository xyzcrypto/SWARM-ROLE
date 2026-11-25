"use client";

import { useEffect } from "react";
import { sfx } from "../client/audio";

/**
 * The Academy's tactile layer, installed once by the layout:
 *  - every tap on a button, link or option gets a ripple at the finger, a
 *    soft tap sound and a light haptic (Android; iOS has no vibration API);
 *  - on devices with a real pointer, cards light up under the cursor (a CSS
 *    radial highlight driven by --mx/--my, see academy.css "card spotlight").
 *
 * Nothing here renders React output and nothing changes the DOM React owns:
 * the ripple is a detached element on <body>, and the spotlight only sets two
 * CSS variables, so this can never cause a hydration mismatch or a re-render.
 */
export function AcademyFx() {
  useEffect(() => {
    const root = () => document.querySelector(".acad-main");
    let lastTap = 0;
    const onDown = (e: PointerEvent) => {
      const r = root();
      const t = e.target as Element | null;
      if (!r || !t || !r.contains(t)) return;
      const el = t.closest("a[href], button, [role='button'], [role='radio'], [role='tab'], label, summary") as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      if (document.documentElement.classList.contains("motion-off")) return;
      const now = performance.now();
      if (now - lastTap < 45) return;
      lastTap = now;
      const rip = document.createElement("span");
      rip.className = "acad-ripple";
      rip.style.left = `${e.clientX}px`;
      rip.style.top = `${e.clientY}px`;
      document.body.appendChild(rip);
      setTimeout(() => rip.remove(), 650);
      sfx("tap");
    };
    let raf = 0;
    let lit: HTMLElement | null = null;
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = (e.target as Element | null)?.closest?.(".acad-shell .surface") as HTMLElement | null;
        if (lit && lit !== card) {
          lit.style.removeProperty("--mx");
          lit.style.removeProperty("--my");
        }
        lit = card;
        if (!card) return;
        const b = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - b.left}px`);
        card.style.setProperty("--my", `${e.clientY - b.top}px`);
      });
    };
    document.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    if (fine) document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true } as EventListenerOptions);
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
