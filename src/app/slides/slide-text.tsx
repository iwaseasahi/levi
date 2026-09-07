"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import {
  defaultSlideVerticalAlignment,
  type SlideVerticalAlignment,
} from "@/domain/slides/slide";
import {
  parseSlideTextDocument,
  slideTextSizeScale,
  type SlideRichTextNode,
  type SlideTextDocument,
} from "@/domain/slides/text-document";
import { useSlideTextFit } from "./use-slide-text-fit";

function RichInline({ nodes }: { nodes: readonly SlideRichTextNode[] }) {
  return nodes.map((node, index) => {
    if (node.type === "break") return <span key={index}>{"\n"}</span>;
    const style: CSSProperties = {
      fontSize: `${slideTextSizeScale(node.size)}em`,
      fontWeight: node.marks.includes("bold") ? 700 : undefined,
      fontStyle: node.marks.includes("italic") ? "italic" : undefined,
      textDecoration: node.marks.includes("underline")
        ? "underline"
        : undefined,
    };
    return (
      <span key={index} style={style}>
        {node.text}
      </span>
    );
  });
}

function renderDocument(document: SlideTextDocument) {
  return document.blocks.map((block, index) => {
    if (block.type === "bulletList") {
      return (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex} style={{ textAlign: item.alignment }}>
              <RichInline nodes={item.content} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} style={{ textAlign: block.alignment }}>
        <RichInline nodes={block.content} />
      </p>
    );
  });
}

/** Shared document-only 16:9 surface for preview and the slide audience. */
export function SlideText({
  document,
  verticalAlignment = defaultSlideVerticalAlignment,
  blank = false,
}: {
  document: SlideTextDocument;
  verticalAlignment?: SlideVerticalAlignment | undefined;
  blank?: boolean;
}) {
  const richText = useMemo(() => parseSlideTextDocument(document), [document]);
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useSlideTextFit(frame, content, richText);
  return (
    <div className="slide-text-frame" ref={frame}>
      <div
        className="slide-rich-content audience-shadow"
        data-vertical-alignment={verticalAlignment}
        ref={content}
        style={{ visibility: blank ? "hidden" : "visible" }}
      >
        {renderDocument(richText)}
      </div>
    </div>
  );
}
