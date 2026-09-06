"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import type { SlideRecord } from "@/domain/slides/commands";
import { slideImageUploadLimit } from "@/domain/slides/image";
import { parseSlideInput, parseSlideTitle } from "@/domain/slides/slide";
import {
  slideTextDocument,
  type SlideTextDocument,
} from "@/domain/slides/text-document";
import { SlideError, slideErrorMessage } from "./slide-error";
import { SlidePreview } from "./slide-preview";
import { SlideRichTextEditor } from "./slide-rich-text-editor";

type ContentType = "text" | "image";

export function SlideEditor({
  initial,
  fetcher: providedFetcher = fetch,
}: {
  initial?: SlideRecord;
  fetcher?: typeof fetch;
}) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const router = useRouter();
  const initialContentType: ContentType =
    initial?.contentType === "image" ? "image" : "text";
  const [contentType, setContentType] =
    useState<ContentType>(initialContentType);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [document, setDocument] = useState<SlideTextDocument | null>(
    initial?.contentType === "image"
      ? null
      : initial
        ? slideTextDocument(initial.document, initial.body)
        : null,
  );
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewType, setPreviewType] = useState<ContentType | null>(null);
  const [previewDocument, setPreviewDocument] =
    useState<SlideTextDocument | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const savedImageUrl =
    initial?.contentType === "image"
      ? `/api/church/slides/${initial.id}/image?revision=${initial.revision}`
      : null;
  const currentImageUrl = imageUrl ?? savedImageUrl;

  async function mutate(deleting: boolean) {
    if (pending.current) return;
    const replacesSavedContent =
      !deleting &&
      initial !== undefined &&
      (initial.contentType === "image"
        ? contentType === "text" || image !== null
        : contentType === "image");
    if (
      replacesSavedContent &&
      !window.confirm(
        "保存済みのスライド内容を置き換えます。元の内容は復元できません。続けますか？",
      )
    ) {
      return;
    }
    if (
      deleting &&
      (!initial ||
        !window.confirm(
          `「${initial.title}」を完全に削除します。元に戻せません。削除しますか？`,
        ))
    ) {
      deleteButton.current?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    let succeeded = false;
    try {
      let request: RequestInit;
      if (deleting) {
        request = {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ expectedRevision: initial!.revision }),
        };
      } else if (contentType === "text") {
        const input = parseSlideInput({ title, document });
        const requestInput = { title: input.title, document: input.document };
        request = {
          method: initial ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(
            initial
              ? { input: requestInput, expectedRevision: initial.revision }
              : requestInput,
          ),
        };
      } else {
        const normalizedTitle = parseSlideTitle(title);
        if (!image && initial?.contentType === "image") {
          request = {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              input: { contentType: "image", title: normalizedTitle },
              expectedRevision: initial.revision,
            }),
          };
        } else {
          if (!image || image.size > slideImageUploadLimit) {
            throw new Error("INVALID_SLIDE_IMAGE");
          }
          const form = new FormData();
          form.set("title", normalizedTitle);
          form.set("image", image);
          if (initial) form.set("expectedRevision", String(initial.revision));
          request = {
            method: initial ? "PUT" : "POST",
            headers: { Accept: "application/json" },
            body: form,
          };
        }
      }
      const response = await fetcher(
        initial ? `/api/church/slides/${initial.id}` : "/api/church/slides",
        request,
      );
      if (!mounted.current) return;
      if (deleting && response.status === 204) {
        succeeded = true;
        router.replace("/slides");
        return;
      }
      const result = await parseJsonResponse<{ slide: SlideRecord }>(
        response,
        "SLIDE_UNAVAILABLE",
      );
      if (!mounted.current) return;
      succeeded = true;
      router.push(`/slides/${result.slide.id}`);
      router.refresh();
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error && cause.message === "INVALID_SLIDE_IMAGE"
            ? "JPEG、PNG、静止WebPの画像を1枚選択してください。画像は10 MiB以下にしてください。"
            : slideErrorMessage(cause),
        );
      }
    } finally {
      if (mounted.current && !succeeded) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void mutate(false);
  }

  function showPreview() {
    try {
      if (contentType === "text") {
        if (!document) throw new Error("INVALID_SLIDE_INPUT");
        const input = parseSlideInput({
          title: title || "プレビュー",
          document,
        });
        setPreviewDocument(input.document ?? null);
      } else {
        if (!currentImageUrl) throw new Error("INVALID_SLIDE_IMAGE");
        setPreviewDocument(null);
      }
      setPreviewType(contentType);
      setPreviewVersion((value) => value + 1);
      setError(null);
    } catch {
      setPreviewType(null);
      setError(
        contentType === "text"
          ? "プレビューには空白以外を含む1〜100,000文字の本文を入力してください。"
          : "プレビューする画像を選択してください。",
      );
    }
  }

  const updateDocument = useCallback((value: SlideTextDocument | null) => {
    setDocument(value);
  }, []);

  return (
    <>
      <h1>{initial ? "スライドを編集" : "スライドを作成"}</h1>
      {error && <SlideError message={error} />}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <fieldset className="slide-content-choice">
            <legend>スライドの種類</legend>
            <label>
              <input
                type="radio"
                name="slide-content-type"
                value="text"
                checked={contentType === "text"}
                onChange={() => {
                  setContentType("text");
                  setPreviewType(null);
                }}
              />
              テキスト
            </label>
            <label>
              <input
                type="radio"
                name="slide-content-type"
                value="image"
                checked={contentType === "image"}
                onChange={() => {
                  setContentType("image");
                  setPreviewType(null);
                }}
              />
              画像
            </label>
          </fieldset>
          <label htmlFor="slide-title">タイトル</label>
          <input
            id="slide-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          {contentType === "text" ? (
            <>
              <span className="slide-field-label">本文</span>
              <SlideRichTextEditor
                initial={document ?? undefined}
                disabled={busy}
                onChange={updateDocument}
              />
            </>
          ) : (
            <>
              <label htmlFor="slide-image">画像</label>
              <input
                id="slide-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={!savedImageUrl}
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  if (imageUrlRef.current)
                    URL.revokeObjectURL(imageUrlRef.current);
                  imageUrlRef.current = selected
                    ? URL.createObjectURL(selected)
                    : null;
                  setImage(selected);
                  setImageUrl(imageUrlRef.current);
                  setPreviewType(null);
                  if (selected && selected.size > slideImageUploadLimit) {
                    setError("画像は10 MiB以下にしてください。");
                  } else {
                    setError(null);
                  }
                }}
              />
              <p>JPEG、PNG、静止WebPを選択できます。上限は10 MiBです。</p>
              <p>
                教会全体の画像容量上限に達した場合は保存できません。不要な画像スライドを削除してから再度お試しください。
              </p>
            </>
          )}
          <div className="slide-actions slide-editor-actions">
            <button className="primary-button" type="submit">
              {busy ? "処理中…" : "保存"}
            </button>
            <button type="button" onClick={showPreview}>
              保存前プレビュー
            </button>
            {initial && (
              <button
                type="button"
                ref={deleteButton}
                onClick={() => void mutate(true)}
              >
                スライドを削除
              </button>
            )}
          </div>
        </fieldset>
      </form>
      {busy && <p role="status">処理中です。</p>}
      {previewType && (
        <>
          <h2>保存前プレビュー</h2>
          {previewType !== contentType && (
            <p>スライドの種類を変更しました。プレビューを更新してください。</p>
          )}
          {previewType === "text" &&
            JSON.stringify(previewDocument) !== JSON.stringify(document) && (
              <p>本文を変更しました。プレビューを更新してください。</p>
            )}
          {previewType === "image" && currentImageUrl ? (
            <SlidePreview
              key={previewVersion}
              imageSrc={currentImageUrl}
              title={title || "スライド画像"}
            />
          ) : previewDocument !== null ? (
            <SlidePreview
              key={previewVersion}
              text=""
              document={previewDocument}
            />
          ) : null}
        </>
      )}
    </>
  );
}
