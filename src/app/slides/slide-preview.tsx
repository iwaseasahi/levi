"use client";

import { SlideText } from "./slide-text";
import { SlideImage } from "./slide-image";
import type { SlideTextDocument } from "@/domain/slides/text-document";

export function SlidePreview(
  props:
    | { text: string; document?: SlideTextDocument | undefined }
    | { imageSrc: string; title: string },
) {
  return (
    <section
      aria-label={"imageSrc" in props ? "画像プレビュー" : "本文プレビュー"}
      className="slide-preview"
    >
      {"imageSrc" in props ? (
        <SlideImage src={props.imageSrc} title={props.title} />
      ) : (
        <SlideText text={props.text} document={props.document} />
      )}
    </section>
  );
}
