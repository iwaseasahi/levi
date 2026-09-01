"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedBookmarkView } from "@/domain/saved-content";
import { moveTo } from "@/domain/order";
import { ChurchNavigation } from "./church-navigation";
import { useFolderEditor } from "./use-folder-editor";

export function FolderEditPanel({
  folderId,
  fetcher = fetch,
}: {
  folderId: string;
  fetcher?: typeof fetch;
}) {
  const router = useRouter();
  const editor = useFolderEditor({
    fetcher,
    folderId,
    onDeleted: () => router.replace("/folders"),
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editor.error) feedbackRef.current?.focus();
  }, [editor.error]);

  async function updateFolder(event: FormEvent) {
    event.preventDefault();
    await editor.save();
  }

  async function deleteFolder() {
    if (
      !editor.selected ||
      !window.confirm(`「${editor.selected.folder.name}」を削除しますか？`)
    )
      return;
    await editor.deleteFolder();
  }

  async function deleteBookmark(bookmark: SavedBookmarkView) {
    if (!window.confirm(`「${bookmark.title}」を削除しますか？`)) return;
    await editor.deleteBookmark(bookmark.id);
  }

  async function reorderBookmarks(dragged: string, target: string) {
    if (!editor.selected) return;
    const ids = moveTo(
      editor.selected.bookmarks.map(({ id }) => id),
      dragged,
      target,
    );
    setDraggedId(null);
    setDragOverId(null);
    if (!ids) return;
    await editor.reorderBookmarks(ids);
  }

  function beginDrag(event: DragEvent<HTMLElement>, bookmarkId: string) {
    if (editor.pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookmarkId);
    setDraggedId(bookmarkId);
  }

  return (
    <main className="folder-management-page">
      <div className="folder-management-shell">
        <ChurchNavigation />

        <header className="folder-page-header">
          <h1>フォルダーを編集</h1>
        </header>

        {editor.selected ? (
          <div className="folder-editor-grid">
            <section className="management-card" aria-label="フォルダー設定">
              <form className="modern-folder-edit-form" onSubmit={updateFolder}>
                <div className="management-field">
                  <label htmlFor="folder-name">フォルダー名</label>
                  <input
                    disabled={editor.pending}
                    id="folder-name"
                    maxLength={200}
                    value={editor.name}
                    onChange={(event) => editor.setName(event.target.value)}
                  />
                </div>
                <button
                  className="primary-button"
                  disabled={editor.pending || !editor.name.trim()}
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
                  <p className="management-card-kicker">Saved content</p>
                  <h2 id="folder-bookmarks">お気に入り</h2>
                </div>
                <span className="count-badge">
                  {editor.selected.bookmarks.length}件
                </span>
              </div>
              <p className="management-hint">
                ドラッグすると表示順を変更できます。
              </p>
              {editor.selected.bookmarks.length === 0 ? (
                <div className="management-inline-empty">
                  お気に入りはまだありません。
                </div>
              ) : (
                <div className="modern-bookmark-list" role="list">
                  {editor.selected.bookmarks.map((bookmark) => (
                    <article
                      className={`modern-bookmark-row${
                        dragOverId === bookmark.id
                          ? " bookmark-drop-target"
                          : draggedId === bookmark.id
                            ? " bookmark-dragging"
                            : ""
                      }`}
                      data-bookmark-id={bookmark.id}
                      draggable={!editor.pending}
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
                        <span>保存したコンテンツ</span>
                      </div>
                      <div className="modern-bookmark-actions">
                        <button
                          className="danger-button-quiet"
                          disabled={editor.pending}
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

            <section
              aria-label="フォルダーの削除"
              className="management-card danger-zone"
            >
              <p className="danger-zone-copy">
                フォルダー内のお気に入りもすべて削除されます。
              </p>
              <button
                className="danger-button"
                disabled={editor.pending}
                type="button"
                onClick={() => void deleteFolder()}
              >
                フォルダーを削除
              </button>
            </section>
          </div>
        ) : editor.pending ? (
          <div
            className="management-card management-loading"
            aria-label="読み込み中"
          />
        ) : null}

        <div className="management-feedback" aria-live="polite">
          {editor.error ? (
            <div
              className="notice notice-error"
              ref={feedbackRef}
              role="alert"
              tabIndex={-1}
            >
              {editor.error}
            </div>
          ) : null}
          {editor.message ? (
            <div className="notice notice-success" role="status">
              {editor.message}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
