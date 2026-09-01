"use client";

import { useState } from "react";
import { useProjectionController } from "@/app/projection/use-projection-controller";
import type { SlideRecord } from "@/domain/slides/commands";
import {
  parseSlideProjectionState,
  slideAudienceMessages,
} from "@/domain/slides/projection";
import { SlideError } from "./slide-error";
import { useSlideFavorite } from "./use-slide-favorite";

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
  const favorite = useSlideFavorite({
    fetcher,
    selectedFolderId,
    onFavoriteSaved,
  });
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
    <section className="slide-controller" aria-label="投影操作">
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
          aria-label="文字を大きく"
          type="button"
          disabled={!ready || projection.state!.presentation.fontScale >= 2.2}
          onClick={() => projection.control({ action: "font-larger" })}
        >
          文字 +
        </button>
        <button
          aria-label="文字を小さく"
          type="button"
          disabled={!ready || projection.state!.presentation.fontScale <= 0.6}
          onClick={() => projection.control({ action: "font-smaller" })}
        >
          文字 -
        </button>
        <button
          aria-label="空白と表示を切り替え"
          type="button"
          disabled={!ready}
          aria-pressed={projection.state?.presentation.blank ?? false}
          onClick={() => projection.control({ action: "toggle-blank" })}
        >
          空白⇔表示
        </button>
        <button
          className="slide-favorite-button"
          type="button"
          disabled={!selectedFolderId || favorite.savingId !== null}
          onClick={() => void favorite.save(slide.id)}
        >
          {favorite.savingId ? "追加中…" : "お気に入りに追加"}
        </button>
      </div>
      {favorite.error && <SlideError message={favorite.error} />}
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
