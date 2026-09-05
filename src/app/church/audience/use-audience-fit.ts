"use client";

import { useLayoutEffect, type RefObject } from "react";
import { findAudienceFitScale } from "./audience-fit";

export function useAudienceFit({
  blank,
  current,
  fontScale,
  screenRef,
  verseRef,
}: {
  blank: boolean;
  current: unknown;
  fontScale: number;
  screenRef: RefObject<HTMLElement | null>;
  verseRef: RefObject<HTMLDivElement | null>;
}) {
  useLayoutEffect(() => {
    const screen = screenRef.current;
    const verse = verseRef.current;
    const content = verse?.parentElement;
    if (!screen || !verse || !content) return;
    const activeScreen = screen;
    const activeVerse = verse;
    const activeContent = content;
    let animationFrame = 0;
    let cancelled = false;

    function fitVerse() {
      const availableHeight = Math.max(1, activeContent.clientHeight);
      const availableWidth = Math.max(1, activeContent.clientWidth);
      const scale = findAudienceFitScale((candidateScale) => {
        activeScreen.style.setProperty(
          "--audience-fit-scale",
          String(candidateScale),
        );
        return (
          activeVerse.scrollHeight <= availableHeight + 1 &&
          activeVerse.scrollWidth <= availableWidth + 1
        );
      });
      activeScreen.style.setProperty("--audience-fit-scale", String(scale));
    }

    function scheduleFit() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fitVerse);
    }

    fitVerse();
    window.addEventListener("resize", scheduleFit);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleFit);
    resizeObserver?.observe(activeScreen);
    resizeObserver?.observe(activeContent);
    void document.fonts?.ready.then(() => {
      if (!cancelled) scheduleFit();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleFit);
      resizeObserver?.disconnect();
    };
  }, [blank, current, fontScale, screenRef, verseRef]);
}
