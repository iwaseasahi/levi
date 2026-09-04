"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ClientApiError,
  parseJsonResponse,
  requestJson,
} from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import type { SlideListResult } from "@/domain/slides/list";
import { SlideError, slideErrorMessage } from "./slide-error";
import { useSlideFavorite } from "./use-slide-favorite";

type Selection = { cursors: Array<string | null> };
export function SlideList({
  fetcher: providedFetcher = fetch,
  selectedFolderId = null,
  onFavoriteSaved,
}: {
  fetcher?: typeof fetch;
  selectedFolderId?: string | null;
  onFavoriteSaved?(): void;
}) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const [selection, setSelection] = useState<Selection>({ cursors: [null] });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletePending = useRef(false);
  const mounted = useRef(true);
  const [loaded, setLoaded] = useState<{
    selection: Selection;
    result?: SlideListResult;
    error?: string;
  } | null>(null);
  const favorite = useSlideFavorite({
    fetcher,
    selectedFolderId,
    onFavoriteSaved,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    const cursor = selection.cursors.at(-1);
    if (cursor) params.set("cursor", cursor);
    const query = params.size ? `?${params}` : "";
    void requestJson<SlideListResult>(
      fetcher,
      `/api/church/slides${query}`,
      { cache: "no-store" },
      "SLIDE_UNAVAILABLE",
    )
      .then((result) => {
        if (current) setLoaded({ selection, result });
      })
      .catch((cause: unknown) => {
        if (current) setLoaded({ selection, error: slideErrorMessage(cause) });
      });
    return () => {
      current = false;
    };
  }, [selection, fetcher]);
  const active = loaded?.selection === selection ? loaded : null;
  const result = active?.result;
  const page = selection.cursors.length;
  const showPages =
    page > 1 ||
    (loaded?.selection.cursors.length ?? 1) > 1 ||
    Boolean(loaded?.result?.nextCursor);

  async function deleteSlide(slide: SlideListResult["slides"][number]) {
    if (
      deletePending.current ||
      !window.confirm(
        `「${slide.title}」を完全に削除します。元に戻せません。削除しますか？`,
      )
    ) {
      return;
    }

    deletePending.current = true;
    setDeletingId(slide.id);
    setDeleteError(null);
    try {
      const response = await fetcher(`/api/church/slides/${slide.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expectedRevision: slide.revision }),
      });
      if (response.status !== 204) {
        await parseJsonResponse(response, "SLIDE_UNAVAILABLE");
        throw new ClientApiError("SLIDE_UNAVAILABLE", response.status);
      }
      if (!mounted.current) return;
      setLoaded((current) => {
        if (current?.selection !== selection || !current.result) return current;
        return {
          ...current,
          result: {
            ...current.result,
            slides: current.result.slides.filter(
              (currentSlide) => currentSlide.id !== slide.id,
            ),
          },
        };
      });
    } catch (cause) {
      if (mounted.current) setDeleteError(slideErrorMessage(cause));
    } finally {
      deletePending.current = false;
      if (mounted.current) setDeletingId(null);
    }
  }

  const mutating = deletingId !== null || favorite.savingId !== null;
  return (
    <section aria-label="スライド一覧" aria-busy={!active}>
      <p className="slide-list-status" role="status">
        {!active
          ? "読み込み中…"
          : result
            ? result.slides.length
              ? `${page}ページ目 · ${result.slides.length}件（新しく作成した順）`
              : "スライドはまだありません。"
            : "一覧を読み込めませんでした。"}
      </p>
      {active?.error && (
        <>
          <SlideError message={active.error} />
          <button type="button" onClick={() => setSelection({ ...selection })}>
            再試行
          </button>
        </>
      )}
      {favorite.error && <SlideError message={favorite.error} />}
      {deleteError && <SlideError message={deleteError} />}
      <ul className="slide-list">
        {result?.slides.map((slide, index) => (
          <li className="slide-list-item" key={slide.id}>
            <Link
              className="slide-list-row"
              href={`/slides/${slide.id}`}
              aria-labelledby={`slide-type-${slide.id} slide-title-${slide.id}`}
            >
              <span className="slide-list-number" aria-hidden="true">
                {(page - 1) * 20 + index + 1}
              </span>
              <span className="slide-list-content">
                <span className="slide-list-title">
                  <span
                    className="slide-list-type"
                    id={`slide-type-${slide.id}`}
                  >
                    {slide.contentType === "image" ? "画像" : "テキスト"}
                  </span>
                  <span id={`slide-title-${slide.id}`}>{slide.title}</span>
                </span>
              </span>
              <span className="slide-list-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <span className="slide-list-item-actions">
              <button
                className="slide-favorite-button"
                type="button"
                disabled={!selectedFolderId || mutating}
                onClick={() => void favorite.save(slide.id)}
              >
                {favorite.savingId === slide.id
                  ? "追加中…"
                  : "お気に入りに追加"}
              </button>
              <button
                aria-label={
                  deletingId === slide.id
                    ? `${slide.title}を削除中`
                    : `${slide.title}を削除`
                }
                className="slide-list-delete-button"
                type="button"
                disabled={mutating}
                onClick={() => void deleteSlide(slide)}
              >
                {deletingId === slide.id ? "削除中…" : "削除"}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {showPages && (
        <div className="slide-actions">
          <button
            type="button"
            disabled={!result || page === 1 || deletingId !== null}
            onClick={() =>
              setSelection({ cursors: selection.cursors.slice(0, -1) })
            }
          >
            前の20件
          </button>
          <button
            type="button"
            disabled={!result?.nextCursor || deletingId !== null}
            onClick={() =>
              setSelection({
                cursors: [...selection.cursors, result?.nextCursor ?? null],
              })
            }
          >
            次の20件
          </button>
        </div>
      )}
    </section>
  );
}
