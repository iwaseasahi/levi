"use client";

import { useLayoutEffect, type RefObject } from "react";
import { calculateAudienceFitScale } from "./audience-fit";

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
    if (!screen || !verse) return;
    const activeScreen = screen;
    const activeVerse = verse;

    function fitVerse() {
      const headingHeight =
        activeScreen.querySelector<HTMLElement>(".audience-book-name")
          ?.offsetHeight ?? 26;
      const scale = calculateAudienceFitScale({
        availableHeight: Math.max(
          1,
          activeScreen.clientHeight - headingHeight * 2,
        ),
        availableWidth: activeScreen.clientWidth,
        contentHeight: activeVerse.scrollHeight,
        contentWidth: activeVerse.scrollWidth,
      });
      activeScreen.style.setProperty("--audience-fit-scale", String(scale));
    }

    fitVerse();
    window.addEventListener("resize", fitVerse);
    return () => window.removeEventListener("resize", fitVerse);
  }, [blank, current, fontScale, screenRef, verseRef]);
}
