"use client";

import { SlideText } from "./slide-text";

export function SlidePreview({ text }: { text: string }) {
  return (
    <section aria-label="本文プレビュー" className="slide-preview">
      <SlideText text={text} />
    </section>
  );
}
