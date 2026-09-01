"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseJsonResponse } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import type { SlideRecord } from "@/domain/slides/commands";
import { parseSlideBody, parseSlideInput } from "@/domain/slides/slide";
import { SlideError, slideErrorMessage } from "./slide-error";
import { SlidePreview } from "./slide-preview";

export function SlideEditor({
  initial,
  fetcher: providedFetcher = fetch,
}: {
  initial?: SlideRecord;
  fetcher?: typeof fetch;
}) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<{
    body: string;
    text: string;
    version: number;
  } | null>(null);

  async function mutate(deleting: boolean) {
    if (pending.current) return;
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
      const input = deleting ? undefined : parseSlideInput({ title, body });
      const response = await fetcher(
        initial ? `/api/church/slides/${initial.id}` : "/api/church/slides",
        {
          method: deleting ? "DELETE" : initial ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(
            deleting
              ? { expectedRevision: initial!.revision }
              : initial
                ? { input, expectedRevision: initial.revision }
                : input,
          ),
        },
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
      if (mounted.current) setError(slideErrorMessage(cause));
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
      const text = parseSlideBody(body);
      setPreview((previous) => ({
        body,
        text,
        version: (previous?.version ?? 0) + 1,
      }));
      setError(null);
    } catch {
      setPreview(null);
      setError(
        "プレビューには空白以外を含む1〜100,000文字の本文を入力してください。",
      );
    }
  }
  return (
    <>
      <h1>{initial ? "スライドを編集" : "スライドを作成"}</h1>
      {error && <SlideError message={error} />}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          <label htmlFor="slide-title">タイトル（必須）</label>
          <input
            id="slide-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <label htmlFor="slide-body">本文（必須）</label>
          <textarea
            id="slide-body"
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
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
      {preview && (
        <>
          <h2>保存前プレビュー</h2>
          <p>
            保存・投影は行いません。
            {preview.body !== body &&
              "本文を変更しました。プレビューを更新してください。"}
          </p>
          <SlidePreview key={preview.version} text={preview.text} />
        </>
      )}
    </>
  );
}
