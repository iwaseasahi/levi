"use client";

import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import type { ScriptureLanguage } from "@/domain/scripture/search";

type ScriptureSearch = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  language: ScriptureLanguage;
};

type SelectedFolder = {
  folder: FolderSummary;
  bookmarks: ScriptureBookmarkView[];
};

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { error?: { code?: string } };
  if (!response.ok) throw new Error("saved content unavailable");
  return body as T;
}

function move(ids: string[], id: string, offset: -1 | 1) {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
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

export function SavedContentPanel({
  currentSearch,
  fetcher,
  onOpen,
}: {
  currentSearch: ScriptureSearch | null;
  fetcher: typeof fetch;
  onOpen(search: ScriptureSearch): Promise<void>;
}) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(
    null,
  );
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(
    null,
  );
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

  async function refreshFolders() {
    const response = await payload<{
      folders: FolderSummary[];
      orderIds: string[];
    }>(
      await fetcher("/api/saved-content", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
    setFolders(response.folders);
    setOrderIds(response.orderIds);
  }

  async function run(
    action: () => Promise<void>,
    success?: string,
    recover?: () => Promise<void>,
  ) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
      if (success) setMessage(success);
    } catch {
      if (recover) {
        try {
          await recover();
        } catch {
          // Keep the original update failure visible when recovery also fails.
        }
      }
      setError(
        "保存内容を更新できませんでした。再読み込みしてお試しください。",
      );
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => run(refreshFolders));
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) feedbackRef.current?.focus();
  }, [error]);

  async function loadFolder(folderId: string) {
    const value = await payload<SelectedFolder>(
      await fetcher(
        `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      ),
    );
    setSelected(value);
    setFolderName(value.folder.name);
  }

  async function chooseFolder(folderId: string) {
    if (selected?.folder.id === folderId) {
      setSelected(null);
      setFolderName("");
      return;
    }
    await run(async () => {
      await loadFolder(folderId);
      await refreshFolders();
    });
  }

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    await run(async () => {
      const { folder } = await request<{ folder: FolderSummary }>({
        action: "create-folder",
        name,
      });
      setNewFolderName("");
      setNewFolderOpen(false);
      await loadFolder(folder.id);
      await refreshFolders();
    }, "フォルダーを作成しました。");
  }

  async function updateFolder(input: { name?: string; isPinned?: boolean }) {
    if (!selected) return;
    await run(async () => {
      await request({
        action: "update-folder",
        folderId: selected.folder.id,
        ...input,
      });
      await loadFolder(selected.folder.id);
      await refreshFolders();
    }, "フォルダーを更新しました。");
  }

  async function reorderFolder(folderId: string, offset: -1 | 1) {
    const ids = move(orderIds, folderId, offset);
    if (!ids) return;
    await run(async () => {
      await request({ action: "reorder-folders", ids });
      await refreshFolders();
    }, "フォルダーの順序を変更しました。");
  }

  async function removeFolder() {
    if (
      !selected ||
      !window.confirm(`「${selected.folder.name}」を削除しますか？`)
    )
      return;
    await run(async () => {
      await request({ action: "delete-folder", folderId: selected.folder.id });
      setSelected(null);
      setFolderName("");
      await refreshFolders();
    }, "フォルダーを削除しました。");
  }

  async function saveBookmark(event: FormEvent) {
    event.preventDefault();
    const title = bookmarkTitle.trim();
    if (!selected || !currentSearch || !title) return;
    await run(async () => {
      await request({
        action: "create-bookmark",
        folderId: selected.folder.id,
        title,
        ...currentSearch,
      });
      setBookmarkTitle("");
      await loadFolder(selected.folder.id);
      await refreshFolders();
    }, "ブックマークを保存しました。");
  }

  async function openBookmark(bookmarkId: string) {
    await run(async () => {
      const { bookmark } = await request<{ bookmark: ScriptureBookmarkView }>({
        action: "open-bookmark",
        bookmarkId,
      });
      await onOpen(bookmark.search);
      await refreshFolders();
    }, "ブックマークを開きました。");
  }

  async function reorderBookmark(bookmarkId: string, offset: -1 | 1) {
    if (!selected) return;
    const ids = move(
      selected.bookmarks.map(({ id }) => id),
      bookmarkId,
      offset,
    );
    if (!ids) return;
    await run(async () => {
      await request({
        action: "reorder-bookmarks",
        folderId: selected.folder.id,
        ids,
      });
      await loadFolder(selected.folder.id);
      await refreshFolders();
    }, "ブックマークの順序を変更しました。");
  }

  async function reorderBookmarkTo(draggedId: string, targetId: string) {
    if (!selected) return;
    const folderId = selected.folder.id;
    const ids = moveTo(
      selected.bookmarks.map(({ id }) => id),
      draggedId,
      targetId,
    );
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
    if (!ids) return;
    await run(
      async () => {
        await request({ action: "reorder-bookmarks", folderId, ids });
        await loadFolder(folderId);
        await refreshFolders();
      },
      "ブックマークの順序を変更しました。",
      () => loadFolder(folderId),
    );
  }

  function beginBookmarkDrag(
    event: DragEvent<HTMLLIElement>,
    bookmarkId: string,
  ) {
    if (pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookmarkId);
    setDraggedBookmarkId(bookmarkId);
  }

  function finishBookmarkDrag() {
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
  }

  async function removeBookmark(bookmark: ScriptureBookmarkView) {
    if (!selected || !window.confirm(`「${bookmark.title}」を削除しますか？`))
      return;
    await run(async () => {
      await request({ action: "delete-bookmark", bookmarkId: bookmark.id });
      await loadFolder(selected.folder.id);
      await refreshFolders();
    }, "ブックマークを削除しました。");
  }

  function selectedFolderContent() {
    if (!selected) return null;
    return (
      <div
        className="selected-content"
        id={`folder-content-${selected.folder.id}`}
      >
        <h3 className="sr-only">{selected.folder.name}</h3>
        <form
          className="compact-form"
          onSubmit={(event) => {
            event.preventDefault();
            const name = folderName.trim();
            if (name) void updateFolder({ name });
          }}
        >
          <label htmlFor="folder-name">フォルダー名</label>
          <div className="inline-controls">
            <input
              disabled={pending}
              id="folder-name"
              maxLength={200}
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={
                pending ||
                !folderName.trim() ||
                folderName.trim() === selected.folder.name
              }
              type="submit"
            >
              名前を変更
            </button>
          </div>
        </form>
        <div className="folder-actions">
          <button
            className="secondary-button"
            disabled={pending}
            type="button"
            onClick={() =>
              void updateFolder({ isPinned: !selected.folder.isPinned })
            }
          >
            {selected.folder.isPinned
              ? "固定を解除"
              : "よく使うフォルダーに固定"}
          </button>
          <button
            className="danger-button"
            disabled={pending}
            type="button"
            onClick={() => void removeFolder()}
          >
            フォルダーを削除
          </button>
        </div>

        <form className="compact-form" onSubmit={saveBookmark}>
          <label htmlFor="bookmark-title">ブックマーク名</label>
          <div className="inline-controls">
            <input
              disabled={pending}
              id="bookmark-title"
              maxLength={200}
              value={bookmarkTitle}
              onChange={(event) => setBookmarkTitle(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={pending || !currentSearch || !bookmarkTitle.trim()}
              type="submit"
            >
              現在の聖書箇所を保存
            </button>
          </div>
          {!currentSearch ? (
            <p className="hint">先に御言葉を検索すると保存できます。</p>
          ) : null}
        </form>

        {selected.bookmarks.length === 0 ? (
          <p className="empty-copy">ブックマークはまだありません。</p>
        ) : (
          <>
            <p className="bookmark-drag-hint">
              聖書箇所はドラッグして並べ替えできます。
            </p>
            <ol className="bookmark-list" aria-label="保存した聖書箇所">
              {selected.bookmarks.map((bookmark, index) => (
                <li
                  className={
                    dragOverBookmarkId === bookmark.id
                      ? "bookmark-drop-target"
                      : draggedBookmarkId === bookmark.id
                        ? "bookmark-dragging"
                        : undefined
                  }
                  data-bookmark-id={bookmark.id}
                  draggable={!pending}
                  key={bookmark.id}
                  onDragEnd={finishBookmarkDrag}
                  onDragEnter={() => setDragOverBookmarkId(bookmark.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDragStart={(event) => beginBookmarkDrag(event, bookmark.id)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedId =
                      draggedBookmarkId ||
                      event.dataTransfer.getData("text/plain");
                    if (draggedId)
                      void reorderBookmarkTo(draggedId, bookmark.id);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="bookmark-drag-handle"
                    title="ドラッグして並べ替え"
                  >
                    ⠿
                  </span>
                  <button
                    className="bookmark-open"
                    disabled={pending}
                    type="button"
                    onClick={() => void openBookmark(bookmark.id)}
                  >
                    {bookmark.title}
                  </button>
                  <div
                    className="order-actions"
                    aria-label={`${bookmark.title}の操作`}
                  >
                    <button
                      disabled={pending || index === 0}
                      type="button"
                      aria-label={`${bookmark.title}を上へ`}
                      onClick={() => void reorderBookmark(bookmark.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      disabled={
                        pending || index === selected.bookmarks.length - 1
                      }
                      type="button"
                      aria-label={`${bookmark.title}を下へ`}
                      onClick={() => void reorderBookmark(bookmark.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      disabled={pending}
                      type="button"
                      aria-label={`${bookmark.title}を削除`}
                      onClick={() => void removeBookmark(bookmark)}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    );
  }

  return (
    <section
      className="saved-content"
      aria-labelledby="saved-content-title"
      aria-busy={pending}
    >
      <div className="section-heading">
        <p className="eyebrow">Saved scripture</p>
        <h2 id="saved-content-title">フォルダーとブックマーク</h2>
        <p>よく使う御言葉を教会ごとに整理できます。</p>
      </div>

      {pending && folders.length === 0 ? (
        <p role="status">フォルダーを読み込んでいます。</p>
      ) : null}
      {!pending && folders.length === 0 ? (
        <p className="empty-copy">フォルダーはまだありません。</p>
      ) : null}
      {folders.length > 0 ? (
        <ul className="folder-list" aria-label="フォルダー">
          {folders.map((folder) => {
            const open = selected?.folder.id === folder.id;
            return (
              <li
                className={`folder-item${open ? " is-open" : ""}`}
                key={folder.id}
              >
                <button
                  aria-controls={`folder-content-${folder.id}`}
                  aria-expanded={open}
                  className={`folder-toggle${open ? " selected-folder" : ""}`}
                  disabled={pending}
                  type="button"
                  onClick={() => void chooseFolder(folder.id)}
                >
                  <span aria-hidden="true" className="folder-toggle-indicator">
                    {open ? "▾" : "▸"}
                  </span>
                  <span>
                    {folder.isPinned ? "固定：" : ""}
                    {folder.name}
                  </span>
                </button>
                <div
                  className="order-actions folder-order-actions"
                  aria-label={`${folder.name}の順序`}
                >
                  <button
                    disabled={pending || orderIds.indexOf(folder.id) <= 0}
                    type="button"
                    aria-label={`${folder.name}を上へ`}
                    onClick={() => void reorderFolder(folder.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    disabled={
                      pending ||
                      orderIds.indexOf(folder.id) >= orderIds.length - 1
                    }
                    type="button"
                    aria-label={`${folder.name}を下へ`}
                    onClick={() => void reorderFolder(folder.id, 1)}
                  >
                    ↓
                  </button>
                </div>
                {open ? selectedFolderContent() : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        aria-controls="new-folder-form"
        aria-expanded={newFolderOpen}
        className="new-folder-toggle"
        disabled={pending}
        onClick={() => setNewFolderOpen((open) => !open)}
        type="button"
      >
        <span aria-hidden="true">⊕</span> 新規フォルダ作成
      </button>
      {newFolderOpen ? (
        <form
          className="compact-form new-folder-form"
          id="new-folder-form"
          onSubmit={createFolder}
        >
          <label htmlFor="new-folder-name">新しいフォルダー名</label>
          <div className="inline-controls">
            <input
              autoFocus
              disabled={pending}
              id="new-folder-name"
              maxLength={200}
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={pending || !newFolderName.trim()}
              type="submit"
            >
              作成
            </button>
          </div>
        </form>
      ) : null}

      <div className="saved-feedback" aria-live="polite">
        {error ? (
          <div
            className="notice notice-error"
            role="alert"
            tabIndex={-1}
            ref={feedbackRef}
          >
            {error}
          </div>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
      </div>
    </section>
  );
}
