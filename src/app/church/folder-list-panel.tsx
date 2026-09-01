"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FolderSummary } from "@/domain/saved-content";
import { ChurchNavigation } from "./church-navigation";
import { requestJson } from "./client-api";
import { useComponentLifetimeValue } from "./use-component-lifetime-value";

export function FolderListPanel({
  fetcher = fetch,
}: {
  fetcher?: typeof fetch;
}) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const lifetimeFetcher = useComponentLifetimeValue(fetcher);

  const load = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const result = await requestJson<{ folders: FolderSummary[] }>(
        lifetimeFetcher,
        "/api/saved-content",
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
        "folder list unavailable",
      );
      setFolders(result.folders);
    } catch {
      setError(
        "フォルダーを読み込めませんでした。時間をおいてもう一度お試しください。",
      );
    } finally {
      setPending(false);
    }
  }, [lifetimeFetcher]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <main className="folder-management-page">
      <div className="folder-management-shell">
        <ChurchNavigation />

        <header className="folder-page-header">
          <h1>フォルダの一覧</h1>
        </header>

        <section
          aria-busy={pending}
          aria-label="フォルダー一覧"
          className="folder-index-panel"
        >
          {pending ? (
            <div className="folder-loading-grid" aria-label="読み込み中">
              {[0, 1, 2].map((item) => (
                <span aria-hidden="true" key={item} />
              ))}
            </div>
          ) : null}

          {error ? (
            <div
              className="management-state management-state-error"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              <p>{error}</p>
              <button className="secondary-button" onClick={() => void load()}>
                再読み込み
              </button>
            </div>
          ) : null}

          {!pending && !error && folders.length === 0 ? (
            <div className="management-state">
              <span aria-hidden="true" className="management-state-icon">
                ◇
              </span>
              <h2>フォルダーはまだありません</h2>
              <p>左のサイドバーから最初のフォルダーを作成できます。</p>
            </div>
          ) : null}

          {!pending && !error && folders.length > 0 ? (
            <ul className="folder-index-grid">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <article className="folder-index-card">
                    <div className="folder-card-icon" aria-hidden="true">
                      ▱
                    </div>
                    <div className="folder-card-copy">
                      <div className="folder-card-title-row">
                        <h2>{folder.name}</h2>
                        {folder.isPinned ? (
                          <span className="status-badge">固定</span>
                        ) : null}
                      </div>
                      <p>
                        {folder.isPinned
                          ? "よく使うフォルダー"
                          : folder.lastUsedAt
                            ? "最近使用したフォルダー"
                            : "通常のフォルダー"}
                      </p>
                    </div>
                    <a
                      aria-label={`${folder.name}を編集`}
                      className="folder-card-link"
                      href={`/folders/${folder.id}/edit`}
                    >
                      編集する <span aria-hidden="true">→</span>
                    </a>
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
