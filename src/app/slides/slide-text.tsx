"use client";

import { useLayoutEffect, useRef } from "react";

/** Shared body-only 16:9 surface for preview and the slide audience. */
export function SlideText({
  text,
  fontScale = 1,
  blank = false,
}: {
  text: string;
  fontScale?: number;
  blank?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const box = frame.current;
    const pre = content.current;
    if (!box || !pre) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !box.clientWidth || !box.clientHeight) return;
      const desired = box.clientHeight * 0.12 * fontScale;
      pre.style.fontSize = `${desired}px`;
      const scale = Math.min(
        1,
        (box.clientWidth * 0.92) / Math.max(1, pre.scrollWidth),
        (box.clientHeight * 0.92) / Math.max(1, pre.scrollHeight),
      );
      pre.style.fontSize = `${desired * scale}px`;
    };
    fit();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(box);
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [text, fontScale]);
  return (
    <div className="slide-text-frame" ref={frame}>
      <pre ref={content} style={{ visibility: blank ? "hidden" : "visible" }}>
        {text}
      </pre>
    </div>
  );
}
