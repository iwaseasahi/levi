"use client";

import { useLayoutEffect, type RefObject } from "react";

function setFontSize(element: HTMLElement, pixels: number) {
  element.style.fontSize = `${pixels}px`;
}

/** Fits the whole rich-text surface while preserving relative run sizes. */
export function useSlideTextFit(
  frame: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  dependency: unknown,
  fontScale = 1,
) {
  useLayoutEffect(() => {
    const box = frame.current;
    const container = content.current;
    if (!box || !container) return;
    const text = container.querySelector<HTMLElement>(".tiptap") ?? container;
    let disposed = false;
    const fit = () => {
      if (disposed || !box.clientWidth || !box.clientHeight) return;
      const desired = box.clientHeight * 0.12 * fontScale;
      setFontSize(text, desired);
      const scale = Math.min(
        1,
        (box.clientWidth * 0.92) / Math.max(1, text.scrollWidth),
        (box.clientHeight * 0.92) / Math.max(1, text.scrollHeight),
      );
      setFontSize(text, desired * scale);
    };
    fit();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(box);
    window.addEventListener("resize", fit);
    void globalThis.document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [frame, content, dependency, fontScale]);
}
