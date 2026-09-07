"use client";

import type { Editor } from "@tiptap/core";
import type { ReactNode, RefObject } from "react";
import {
  slideTextPercentages,
  type SlideTextAlignment,
  type SlideTextPercentage,
} from "@/domain/slides/text-document";
import type { SlideVerticalAlignment } from "@/domain/slides/slide";
import {
  slideTextPercentageToCss,
  type SlideSelectionSize,
} from "./slide-tiptap";

function ToolbarButton({
  label,
  children,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean | undefined;
  disabled?: boolean;
  onClick(): unknown;
}) {
  return (
    <button
      type="button"
      className="slide-tool-button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const alignmentControls = [
  ["left", "左揃え", "☰"],
  ["center", "中央揃え", "≡"],
  ["right", "右揃え", "☷"],
] as const satisfies ReadonlyArray<
  readonly [SlideTextAlignment, string, string]
>;

const verticalAlignmentControls = [
  ["top", "本文を上揃え", "↥"],
  ["center", "本文を中央揃え", "↕"],
  ["bottom", "本文を下揃え", "↧"],
] as const satisfies ReadonlyArray<
  readonly [SlideVerticalAlignment, string, string]
>;

export function SlideRichTextToolbar({
  editor,
  disabled,
  selectionSize,
  verticalAlignment,
  onVerticalAlignmentChange,
  toolbarRef,
}: {
  editor: Editor | null;
  disabled: boolean;
  selectionSize: SlideSelectionSize;
  verticalAlignment: SlideVerticalAlignment;
  onVerticalAlignmentChange(value: SlideVerticalAlignment): void;
  toolbarRef: RefObject<HTMLDivElement | null>;
}) {
  const unavailable = disabled || !editor;
  const setSize = (size: SlideTextPercentage) => {
    if (!editor) return;
    const css = slideTextPercentageToCss(size);
    if (css) editor.chain().focus().setFontSize(css).run();
    else editor.chain().focus().unsetFontSize().run();
  };
  const setAlignment = (alignment: SlideTextAlignment) => {
    editor?.chain().focus().setTextAlign(alignment).run();
  };

  return (
    <div
      className="slide-rich-toolbar"
      role="toolbar"
      aria-label="本文の書式"
      ref={toolbarRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") editor?.commands.focus();
      }}
    >
      <select
        className="slide-tool-select slide-size-select"
        aria-label="文字サイズ"
        title="文字サイズ"
        value={selectionSize}
        disabled={unavailable}
        onChange={(event) =>
          setSize(Number(event.target.value) as SlideTextPercentage)
        }
      >
        {selectionSize === "mixed" && (
          <option value="mixed" disabled>
            複数サイズ
          </option>
        )}
        {slideTextPercentages.map((percentage) => (
          <option key={percentage} value={percentage}>
            {percentage}%
          </option>
        ))}
      </select>
      <span className="slide-toolbar-group" role="group" aria-label="文字装飾">
        <ToolbarButton
          label="太字"
          active={editor?.isActive("bold")}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <strong aria-hidden="true">B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={editor?.isActive("italic")}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <em aria-hidden="true">I</em>
        </ToolbarButton>
        <ToolbarButton
          label="下線"
          active={editor?.isActive("underline")}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <span className="slide-underline-icon" aria-hidden="true">
            U
          </span>
        </ToolbarButton>
      </span>
      <span className="slide-toolbar-group" role="group" aria-label="文字揃え">
        {alignmentControls.map(([alignment, label, icon]) => (
          <ToolbarButton
            key={alignment}
            label={label}
            active={editor?.isActive({ textAlign: alignment })}
            disabled={unavailable}
            onClick={() => setAlignment(alignment)}
          >
            <span aria-hidden="true">{icon}</span>
          </ToolbarButton>
        ))}
      </span>
      <span
        className="slide-toolbar-group"
        role="group"
        aria-label="本文の縦位置"
      >
        {verticalAlignmentControls.map(([alignment, label, icon]) => (
          <ToolbarButton
            key={alignment}
            label={label}
            active={verticalAlignment === alignment}
            disabled={unavailable}
            onClick={() => onVerticalAlignmentChange(alignment)}
          >
            <span aria-hidden="true">{icon}</span>
          </ToolbarButton>
        ))}
      </span>
      <span className="slide-toolbar-group" role="group" aria-label="リスト">
        <ToolbarButton
          label="箇条書き"
          active={editor?.isActive("bulletList")}
          disabled={unavailable}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <span aria-hidden="true">•☰</span>
        </ToolbarButton>
      </span>
      <span className="slide-toolbar-group" role="group" aria-label="編集履歴">
        <ToolbarButton
          label="元に戻す"
          disabled={unavailable || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <span aria-hidden="true">↶</span>
        </ToolbarButton>
        <ToolbarButton
          label="やり直す"
          disabled={unavailable || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <span aria-hidden="true">↷</span>
        </ToolbarButton>
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {selectionSize === "mixed" ? "複数サイズ" : `${selectionSize}%`}
      </span>
    </div>
  );
}
