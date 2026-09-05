"use client";

import {
  Fragment,
  Slice,
  type Mark,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  SlideTextAlignment,
  SlideTextDocument,
  SlideTextPercentage,
} from "@/domain/slides/text-document";
import {
  emptySlideTiptapDocument,
  slideDocumentToTiptapJson,
  slideTextSizeOptions,
  slideTiptapExtensions,
  tiptapJsonToSlideDocument,
} from "./slide-tiptap";
import { useSlideTextFit } from "./use-slide-text-fit";

type SlideEditorInstance = NonNullable<ReturnType<typeof useEditor>>;
type SelectionSize = number | "mixed";

function selectedSize(editor: SlideEditorInstance): SelectionSize {
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
  if (value === undefined) return 100;
  if (value === null) return 100;
  const percent = Number(value.replace(/%$/, ""));
  return Number.isFinite(percent) ? percent : "mixed";
}

function allowedStoredMarks(view: EditorView): readonly Mark[] {
  const allowed = new Set(["bold", "italic", "underline", "textStyle"]);
  return (view.state.storedMarks ?? view.state.selection.$from.marks()).filter(
    (mark) => allowed.has(mark.type.name),
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
  const [selectionSize, setSelectionSize] = useState<SelectionSize>(100);
  const refreshSelection = useCallback((editor: SlideEditorInstance) => {
    setVersion((value) => value + 1);
    setSelectionSize(selectedSize(editor));
  }, []);
  const report = useCallback(
    (editor: SlideEditorInstance) => {
      refreshSelection(editor);
      try {
        onChange(tiptapJsonToSlideDocument(editor.getJSON()));
      } catch {
        onChange(null);
      }
    },
    [onChange, refreshSelection],
  );
  const editor = useEditor({
    extensions: slideTiptapExtensions,
    content: initial
      ? slideDocumentToTiptapJson(initial)
      : emptySlideTiptapDocument,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => report(editor),
    onSelectionUpdate: ({ editor }) => refreshSelection(editor),
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
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);
  useSlideTextFit(frame, content, version);

  function setSize(size: SlideTextPercentage) {
    if (!editor) return;
    const option = slideTextSizeOptions.find((item) => item.size === size)!;
    if (option.css) editor.chain().focus().setFontSize(option.css).run();
    else editor.chain().focus().unsetFontSize().run();
  }

  function setAlignment(alignment: SlideTextAlignment) {
    editor?.chain().focus().setTextAlign(alignment).run();
  }

  const unavailable = disabled || !editor;
  return (
    <div className="slide-rich-editor">
      <div className="slide-rich-editor-shell">
        <div
          className="slide-rich-toolbar"
          role="toolbar"
          aria-label="本文の書式"
          ref={toolbar}
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
            {selectionSize !== "mixed" &&
              !slideTextSizeOptions.some(
                (option) => option.size === selectionSize,
              ) && (
                <option value={selectionSize} disabled>
                  {selectionSize}%（旧形式）
                </option>
              )}
            {slideTextSizeOptions.map((option) => (
              <option key={option.size} value={option.size}>
                {option.percent}%
              </option>
            ))}
          </select>
          <span
            className="slide-toolbar-group"
            role="group"
            aria-label="文字装飾"
          >
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
          <span
            className="slide-toolbar-group"
            role="group"
            aria-label="文字揃え"
          >
            {(
              [
                ["left", "左揃え", "☰"],
                ["center", "中央揃え", "≡"],
                ["right", "右揃え", "☷"],
              ] as const
            ).map(([alignment, label, icon]) => (
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
            aria-label="リスト"
          >
            <ToolbarButton
              label="箇条書き"
              active={editor?.isActive("bulletList")}
              disabled={unavailable}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <span aria-hidden="true">•☰</span>
            </ToolbarButton>
          </span>
          <span
            className="slide-toolbar-group"
            role="group"
            aria-label="編集履歴"
          >
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
        <div className="slide-text-frame slide-rich-editor-frame" ref={frame}>
          <span className="slide-editor-surface-label" aria-hidden="true">
            16:9 編集エリア
          </span>
          <div className="slide-rich-editor-content" ref={content}>
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
