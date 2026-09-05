"use client";

import { Fragment, Slice } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SlideTextDocument,
  SlideTextSize,
} from "@/domain/slides/text-document";
import {
  emptySlideTiptapDocument,
  slideDocumentToTiptapJson,
  slideTextSizeOptions,
  slideTiptapExtensions,
  tiptapJsonToSlideDocument,
} from "./slide-tiptap";
import { useSlideTextFit } from "./use-slide-text-fit";

type SelectionSize = SlideTextSize | "mixed";

function selectedSize(
  editor: NonNullable<ReturnType<typeof useEditor>>,
): SelectionSize {
  const { from, to, empty } = editor.state.selection;
  const values = new Set<string | null>();
  if (empty) {
    const marks =
      editor.state.storedMarks ?? editor.state.selection.$from.marks();
    values.add(
      marks.find((mark) => mark.type.name === "textStyle")?.attrs.fontSize ??
        null,
    );
  } else {
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return;
      values.add(
        node.marks.find((mark) => mark.type.name === "textStyle")?.attrs
          .fontSize ?? null,
      );
    });
  }
  if (values.size !== 1) return "mixed";
  const value = [...values][0];
  return (
    slideTextSizeOptions.find((option) => option.css === value)?.size ??
    "normal"
  );
}

export function SlideRichTextEditor({
  initial,
  disabled,
  onChange,
}: {
  initial?: SlideTextDocument | undefined;
  disabled: boolean;
  onChange(document: SlideTextDocument | null): void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [selectionSize, setSelectionSize] = useState<SelectionSize>("normal");
  const report = useCallback(
    (editor: NonNullable<ReturnType<typeof useEditor>>) => {
      setVersion((value) => value + 1);
      setSelectionSize(selectedSize(editor));
      try {
        onChange(tiptapJsonToSlideDocument(editor.getJSON()));
      } catch {
        onChange(null);
      }
    },
    [onChange],
  );
  const editor = useEditor({
    extensions: slideTiptapExtensions,
    content: initial
      ? slideDocumentToTiptapJson(initial)
      : emptySlideTiptapDocument,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => report(editor),
    onSelectionUpdate: ({ editor }) => setSelectionSize(selectedSize(editor)),
    editorProps: {
      attributes: {
        "aria-label": "本文",
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        if (event.altKey && event.key === "F10") {
          toolbar.current?.querySelector<HTMLButtonElement>("button")?.focus();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData?.getData("text/plain");
        if (clipboard === undefined) return true;
        const value = clipboard.replace(/\r\n?/g, "\n");
        const marks =
          view.state.storedMarks ?? view.state.selection.$from.marks();
        const textStyle = marks.find((mark) => mark.type.name === "textStyle");
        const nodes = value
          .split("\n")
          .flatMap((line, index, lines) => [
            ...(line
              ? [view.state.schema.text(line, textStyle ? [textStyle] : [])]
              : []),
            ...(index < lines.length - 1
              ? [view.state.schema.nodes.hardBreak!.create()]
              : []),
          ]);
        view.dispatch(
          view.state.tr.replaceSelection(
            new Slice(Fragment.fromArray(nodes), 0, 0),
          ),
        );
        return true;
      },
      handleDrop: () => true,
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);
  useSlideTextFit(frame, content, version);

  function setSize(size: SlideTextSize) {
    if (!editor) return;
    const option = slideTextSizeOptions.find((item) => item.size === size)!;
    if (option.css) editor.chain().focus().setFontSize(option.css).run();
    else editor.chain().focus().unsetFontSize().run();
  }

  return (
    <div className="slide-rich-editor">
      <div
        className="slide-size-toolbar"
        role="toolbar"
        aria-label="文字サイズ"
        ref={toolbar}
        onKeyDown={(event) => {
          if (event.key === "Escape") editor?.commands.focus();
        }}
      >
        {slideTextSizeOptions.map((option) => (
          <button
            key={option.size}
            type="button"
            aria-pressed={selectionSize === option.size}
            disabled={disabled || !editor}
            onClick={() => setSize(option.size)}
          >
            {option.label}（{option.percent}%）
          </button>
        ))}
        <span role="status" aria-live="polite">
          {selectionSize === "mixed"
            ? "選択範囲: 複数のサイズ"
            : `選択範囲: ${slideTextSizeOptions.find((option) => option.size === selectionSize)!.label}`}
        </span>
      </div>
      <div className="slide-text-frame slide-rich-editor-frame" ref={frame}>
        <div ref={content}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <p className="slide-editor-help">
        文字を選択してサイズを変更できます。貼り付け時は文字と改行だけを取り込みます。
      </p>
    </div>
  );
}
