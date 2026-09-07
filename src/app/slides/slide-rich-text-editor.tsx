"use client";

import {
  Fragment,
  Slice,
  type Mark,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideVerticalAlignment } from "@/domain/slides/slide";
import type { SlideTextDocument } from "@/domain/slides/text-document";
import { SlideRichTextToolbar } from "./slide-rich-text-toolbar";
import {
  emptySlideTiptapDocument,
  selectedSlideTextSize,
  slideDocumentToTiptapJson,
  slideTiptapExtensions,
  tiptapJsonToSlideDocument,
} from "./slide-tiptap";
import { useSlideTextFit } from "./use-slide-text-fit";

type SlideEditorInstance = NonNullable<ReturnType<typeof useEditor>>;
const allowedStoredMarkNames = new Set([
  "bold",
  "italic",
  "underline",
  "textStyle",
]);

function allowedStoredMarks(view: EditorView): readonly Mark[] {
  return (view.state.storedMarks ?? view.state.selection.$from.marks()).filter(
    (mark) => allowedStoredMarkNames.has(mark.type.name),
  );
}

function plainTextSlice(view: EditorView, value: string): Slice {
  const marks = allowedStoredMarks(view);
  const nodes: ProseMirrorNode[] = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line, index, lines) => [
      ...(line ? [view.state.schema.text(line, marks)] : []),
      ...(index < lines.length - 1
        ? [view.state.schema.nodes.hardBreak!.create()]
        : []),
    ]);
  return new Slice(Fragment.fromArray(nodes), 0, 0);
}

export function SlideRichTextEditor({
  initial,
  disabled,
  verticalAlignment,
  onChange,
  onVerticalAlignmentChange,
}: {
  initial?: SlideTextDocument | undefined;
  disabled: boolean;
  verticalAlignment: SlideVerticalAlignment;
  onChange(document: SlideTextDocument | null): void;
  onVerticalAlignmentChange(value: SlideVerticalAlignment): void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [contentVersion, setContentVersion] = useState(0);
  const report = useCallback(
    (editor: SlideEditorInstance) => {
      setContentVersion((value) => value + 1);
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
    editorProps: {
      attributes: {
        "aria-label": "本文",
        role: "textbox",
        "aria-multiline": "true",
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        if (
          event.key === "Tab" &&
          !event.shiftKey &&
          Array.from(
            { length: _view.state.selection.$from.depth + 1 },
            (_, depth) => _view.state.selection.$from.node(depth).type.name,
          ).includes("listItem")
        ) {
          return true;
        }
        if (event.altKey && event.key === "F10") {
          toolbar.current
            ?.querySelector<HTMLElement>("select, button")
            ?.focus();
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData?.getData("text/plain");
        if (clipboard === undefined) return true;
        view.dispatch(
          view.state.tr.replaceSelection(plainTextSlice(view, clipboard)),
        );
        return true;
      },
      handleDrop: (view, event) => {
        const value = event.dataTransfer?.getData("text/plain");
        if (!value) return true;
        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (!position) return true;
        view.dispatch(
          view.state.tr
            .setSelection(
              TextSelection.near(view.state.doc.resolve(position.pos)),
            )
            .replaceSelection(plainTextSlice(view, value)),
        );
        return true;
      },
    },
  });
  // Keep toolbar active/disabled states synchronized with Tiptap transactions.
  useEditorState({
    editor,
    selector: ({ transactionNumber }) => transactionNumber,
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);
  useSlideTextFit(frame, content, contentVersion);
  const selectionSize = editor ? selectedSlideTextSize(editor) : 100;
  return (
    <div className="slide-rich-editor">
      <div className="slide-rich-editor-shell">
        <SlideRichTextToolbar
          editor={editor}
          disabled={disabled}
          selectionSize={selectionSize}
          verticalAlignment={verticalAlignment}
          onVerticalAlignmentChange={onVerticalAlignmentChange}
          toolbarRef={toolbar}
        />
        <div className="slide-text-frame slide-rich-editor-frame" ref={frame}>
          <div
            className="slide-rich-editor-content"
            data-vertical-alignment={verticalAlignment}
            ref={content}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <p className="slide-editor-help">
        文字を選択して書式を変更できます。貼り付けとドロップでは文字と改行だけを取り込みます。
      </p>
    </div>
  );
}
