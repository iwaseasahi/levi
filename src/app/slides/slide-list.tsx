"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/app/church/client-api";
import { postJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import type { SlideSearchResult } from "@/domain/slides/search";
import { SlideError, slideErrorMessage } from "./slide-error";

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
  const [loaded, setLoaded] = useState<{
    selection: Selection;
    result?: SlideSearchResult;
    error?: string;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState("");
  async function saveFavorite(slideId: string) {
    if (!selectedFolderId || savingId) return;
    setSavingId(slideId);
    setFavoriteError("");
    try {
      await postJson(
        fetcher,
        "/api/saved-content",
        {
          action: "create-slide-bookmark",
          folderId: selectedFolderId,
          slideId,
        },
        "saved content unavailable",
      );
      onFavoriteSaved?.();
    } catch {
      setFavoriteError(
        "お気に入りに追加できませんでした。再度お試しください。",
      );
    } finally {
      setSavingId(null);
    }
  }
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ mode: "all" });
    const cursor = selection.cursors.at(-1);
    if (cursor) params.set("cursor", cursor);
    void requestJson<SlideSearchResult>(
      fetcher,
      `/api/church/slides?${params}`,
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
      {favoriteError && <SlideError message={favoriteError} />}
      <ul className="slide-list">
        {result?.slides.map((slide, index) => (
          <li className="slide-list-item" key={slide.id}>
            <Link
              className="slide-list-row"
              href={`/slides/${slide.id}`}
              aria-labelledby={`slide-title-${slide.id}`}
            >
              <span className="slide-list-number" aria-hidden="true">
                {(page - 1) * 20 + index + 1}
              </span>
              <span className="slide-list-content">
                <span
                  className="slide-list-title"
                  id={`slide-title-${slide.id}`}
                >
                  {slide.title}
                </span>
              </span>
              <span className="slide-list-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <button
              className="slide-favorite-button"
              type="button"
              disabled={!selectedFolderId || savingId !== null}
              onClick={() => void saveFavorite(slide.id)}
            >
              {savingId === slide.id ? "追加中…" : "お気に入りに追加"}
            </button>
          </li>
        ))}
      </ul>
      {showPages && (
        <div className="slide-actions">
          <button
            type="button"
            disabled={!result || page === 1}
            onClick={() =>
              setSelection({ cursors: selection.cursors.slice(0, -1) })
            }
          >
            前の20件
          </button>
          <button
            type="button"
            disabled={!result?.nextCursor}
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
