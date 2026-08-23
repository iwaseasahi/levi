"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";

type SelectedFolder = {
  folder: FolderSummary;
  bookmarks: ScriptureBookmarkView[];
};

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error("saved content unavailable");
  return body;
}

function moveTo(ids: string[], draggedId: string, targetId: string) {
  const from = ids.indexOf(draggedId);
  const target = ids.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(target, 0, draggedId);
  return next;
}

export function FolderEditPanel({
  folderId,
  fetcher = fetch,
}: {
  folderId: string;
  fetcher?: typeof fetch;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [name, setName] = useState("");
  const [pinned, setPinned] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);

  async function request<T>(body: object) {
    return payload<T>(
      await fetcher("/api/saved-content", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  async function load() {
    const value = await payload<SelectedFolder>(
      await fetcher(
        `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      ),
    );
    setSelected(value);
    setName(value.folder.name);
    setPinned(value.folder.isPinned);
  }

  async function run(action: () => Promise<void>, success?: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (success) setMessage(success);
    } catch {
      setError(
        "保存内容を更新できませんでした。再読み込みしてお試しください。",
      );
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => run(load));
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  useEffect(() => {
    if (error) feedbackRef.current?.focus();
  }, [error]);

  async function updateFolder(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await run(async () => {
      await request({
        action: "update-folder",
        folderId,
        name: name.trim(),
        isPinned: pinned,
      });
      await load();
    }, "フォルダーを更新しました。");
  }

  async function deleteFolder() {
    if (
      !selected ||
      !window.confirm(`「${selected.folder.name}」を削除しますか？`)
    )
      return;
    await run(async () => {
      await request({ action: "delete-folder", folderId });
      router.replace("/folders");
    });
  }

  async function deleteBookmark(bookmark: ScriptureBookmarkView) {
    if (!window.confirm(`「${bookmark.title}」を削除しますか？`)) return;
    await run(async () => {
      await request({ action: "delete-bookmark", bookmarkId: bookmark.id });
      await load();
    }, "お気に入りを削除しました。");
  }

  async function reorderBookmarks(dragged: string, target: string) {
    if (!selected) return;
    const ids = moveTo(
      selected.bookmarks.map(({ id }) => id),
      dragged,
      target,
    );
    setDraggedId(null);
    setDragOverId(null);
    if (!ids) return;
    await run(async () => {
      await request({ action: "reorder-bookmarks", folderId, ids });
      await load();
    });
  }

  function beginDrag(event: DragEvent<HTMLElement>, bookmarkId: string) {
    if (pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookmarkId);
    setDraggedId(bookmarkId);
  }

  return (
    <main className="folder-management-page">
      <div className="folder-management-shell">
        <a className="management-back-link" href="/folders">
          <span aria-hidden="true">←</span> フォルダの一覧へ
        </a>

        <header className="folder-page-header">
          <h1>フォルダーを編集</h1>
        </header>

        {selected ? (
          <div className="folder-editor-grid">
            <section
              className="management-card"
              aria-labelledby="folder-settings"
            >
              <div className="management-card-heading">
                <div>
                  <p className="management-card-kicker">基本設定</p>
                  <h2 id="folder-settings">フォルダー設定</h2>
                </div>
                {selected.folder.isPinned ? (
                  <span className="status-badge">固定</span>
                ) : null}
              </div>
              <form className="modern-folder-edit-form" onSubmit={updateFolder}>
                <div className="management-field">
                  <label htmlFor="folder-name">フォルダー名</label>
                  <input
                    disabled={pending}
                    id="folder-name"
                    maxLength={200}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <label className="modern-check-row" htmlFor="folder-pinned">
                  <input
                    checked={pinned}
                    disabled={pending}
                    id="folder-pinned"
                    type="checkbox"
                    onChange={(event) => setPinned(event.target.checked)}
                  />
                  <span>
                    <strong>よく使うフォルダーに固定</strong>
                    <small>一覧の上部に表示されます</small>
                  </span>
                </label>
                <button
                  className="primary-button"
                  disabled={pending || !name.trim()}
                  type="submit"
                >
                  変更を保存
                </button>
              </form>
            </section>

            <section
              className="management-card management-card-wide"
              aria-labelledby="folder-bookmarks"
            >
              <div className="management-card-heading">
                <div>
                  <p className="management-card-kicker">Saved scripture</p>
                  <h2 id="folder-bookmarks">お気に入り</h2>
                </div>
                <span className="count-badge">
                  {selected.bookmarks.length}件
                </span>
              </div>
              <p className="management-hint">
                ドラッグすると表示順を変更できます。
              </p>
              {selected.bookmarks.length === 0 ? (
                <div className="management-inline-empty">
                  お気に入りはまだありません。
                </div>
              ) : (
                <div className="modern-bookmark-list" role="list">
                  {selected.bookmarks.map((bookmark) => (
                    <article
                      className={`modern-bookmark-row${
                        dragOverId === bookmark.id
                          ? " bookmark-drop-target"
                          : draggedId === bookmark.id
                            ? " bookmark-dragging"
                            : ""
                      }`}
                      data-bookmark-id={bookmark.id}
                      draggable={!pending}
                      key={bookmark.id}
                      role="listitem"
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                      }}
                      onDragEnter={() => setDragOverId(bookmark.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDragStart={(event) => beginDrag(event, bookmark.id)}
                      onDrop={(event) => {
                        event.preventDefault();
                        const source =
                          draggedId || event.dataTransfer.getData("text/plain");
                        if (source) void reorderBookmarks(source, bookmark.id);
                      }}
                    >
                      <span className="drag-handle" aria-hidden="true">
                        ⠿
                      </span>
                      <div className="modern-bookmark-copy">
                        <strong>{bookmark.title}</strong>
                        <span>保存した聖書箇所</span>
                      </div>
                      <div className="modern-bookmark-actions">
                        <a
                          className="secondary-link"
                          href={`/bookmarks/${bookmark.id}/edit?folderId=${folderId}`}
                        >
                          編集
                        </a>
                        <button
                          className="danger-button-quiet"
                          disabled={pending}
                          type="button"
                          onClick={() => void deleteBookmark(bookmark)}
                        >
                          削除
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="management-card danger-zone">
              <div>
                <p className="management-card-kicker">Danger zone</p>
                <h2>フォルダーの削除</h2>
                <p>フォルダー内のお気に入りもすべて削除されます。</p>
              </div>
              <button
                className="danger-button"
                disabled={pending}
                type="button"
                onClick={() => void deleteFolder()}
              >
                フォルダーを削除
              </button>
            </section>
          </div>
        ) : pending ? (
          <div
            className="management-card management-loading"
            aria-label="読み込み中"
          />
        ) : null}

        <div className="management-feedback" aria-live="polite">
          {error ? (
            <div
              className="notice notice-error"
              ref={feedbackRef}
              role="alert"
              tabIndex={-1}
            >
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="notice notice-success" role="status">
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
