"use client";

import { useState } from "react";
import { postJson } from "@/app/church/client-api";
import { useProjectionController } from "@/app/projection/use-projection-controller";
import type { SlideRecord } from "@/domain/slides/commands";
import {
  parseSlideProjectionState,
  slideAudienceMessages,
} from "@/domain/slides/projection";
import { SlideError } from "./slide-error";

export function SlideController({
  slide,
  fetcher = fetch,
  selectedFolderId = null,
  onFavoriteSaved,
}: {
  slide: SlideRecord;
  fetcher?: typeof fetch;
  selectedFolderId?: string | null;
  onFavoriteSaved?(): void;
}) {
  const projection = useProjectionController(
    "slide",
    parseSlideProjectionState,
    {
      canControl: (content) =>
        content.status === "ready" &&
        content.id === slide.id &&
        content.revision === slide.revision,
      keyboardNavigation: false,
    },
  );
  const [opened, setOpened] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
  async function saveFavorite() {
    if (!selectedFolderId || savingFavorite) return;
    setSavingFavorite(true);
    setFavoriteError("");
    try {
      await postJson(
        fetcher,
        "/api/saved-content",
        {
          action: "create-slide-bookmark",
          folderId: selectedFolderId,
          slideId: slide.id,
        },
        "saved content unavailable",
      );
      onFavoriteSaved?.();
    } catch {
      setFavoriteError(
        "お気に入りに追加できませんでした。再度お試しください。",
      );
    } finally {
      setSavingFavorite(false);
    }
  }
  const current = projection.state?.content;
  const mismatch =
    current?.status === "ready" &&
    (current.id !== slide.id || current.revision !== slide.revision);
  const ready = projection.ready && !mismatch;
  const error = mismatch
    ? slideAudienceMessages.stale
    : current && current.status !== "ready" && current.status !== "loading"
      ? slideAudienceMessages[current.status]
      : projection.error;
  return (
    <section aria-label="投影操作">
      <h2>投影</h2>
      <div className="slide-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setOpened(true);
            projection.open(`/slides/audience?id=${slide.id}`);
          }}
        >
          Open
        </button>
        <button
          type="button"
          disabled={!ready || projection.state!.presentation.fontScale >= 2.2}
          onClick={() => projection.control({ action: "font-larger" })}
        >
          文字を大きく
        </button>
        <button
          type="button"
          disabled={!ready || projection.state!.presentation.fontScale <= 0.6}
          onClick={() => projection.control({ action: "font-smaller" })}
        >
          文字を小さく
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-pressed={projection.state?.presentation.blank ?? false}
          onClick={() => projection.control({ action: "toggle-blank" })}
        >
          空白と表示を切り替え
        </button>
        <button
          className="slide-favorite-button"
          type="button"
          disabled={!selectedFolderId || savingFavorite}
          onClick={() => void saveFavorite()}
        >
          {savingFavorite ? "追加中…" : "お気に入りに追加"}
        </button>
      </div>
      {favoriteError && <SlideError message={favoriteError} />}
      <p role="status">
        {error
          ? "投影停止"
          : ready
            ? `${projection.state!.presentation.blank ? "空白投影" : "投影中"} · ${Math.round(projection.state!.presentation.fontScale * 100)}%`
            : opened
              ? "接続中…"
              : "投映画面は開いていません。"}
      </p>
      {error && (
        <>
          <SlideError message={error} />
          <button type="button" onClick={() => window.location.reload()}>
            最新の内容を読み込む
          </button>
        </>
      )}
    </section>
  );
}
