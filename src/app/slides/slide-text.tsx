"use client";

import { useMemo, useRef } from "react";
import {
  slideTextDocument,
  slideTextSizeScale,
  type SlideTextDocument,
} from "@/domain/slides/text-document";
import { useSlideTextFit } from "./use-slide-text-fit";

/** Shared body-only 16:9 surface for preview and the slide audience. */
export function SlideText({
  text,
  document,
  fontScale = 1,
  blank = false,
}: {
  text: string;
  document?: SlideTextDocument | undefined;
  fontScale?: number;
  blank?: boolean;
}) {
  const richText = useMemo(
    () => slideTextDocument(document, text),
    [document, text],
  );
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLPreElement>(null);
  useSlideTextFit(frame, content, richText, fontScale);
  return (
    <div className="slide-text-frame" ref={frame}>
      <pre
        className="audience-shadow"
        ref={content}
        style={{ visibility: blank ? "hidden" : "visible" }}
      >
        {richText.nodes.map((node, index) =>
          node.type === "break" ? (
            <span key={index}>{"\n"}</span>
          ) : (
            <span
              key={index}
              style={{ fontSize: `${slideTextSizeScale(node.size)}em` }}
            >
              {node.text}
            </span>
          ),
        )}
      </pre>
    </div>
  );
}
