"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [folderName, setFolderName] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
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

  async function removeBookmark(bookmark: ScriptureBookmarkView) {
    if (!selected || !window.confirm(`「${bookmark.title}」を削除しますか？`))
      return;
    await run(async () => {
      await request({ action: "delete-bookmark", bookmarkId: bookmark.id });
      await loadFolder(selected.folder.id);
      await refreshFolders();
    }, "ブックマークを削除しました。");
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

      <form className="compact-form" onSubmit={createFolder}>
        <label htmlFor="new-folder-name">新しいフォルダー名</label>
        <div className="inline-controls">
          <input
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

      {pending && folders.length === 0 ? (
        <p role="status">フォルダーを読み込んでいます。</p>
      ) : null}
      {!pending && folders.length === 0 ? (
        <p className="empty-copy">フォルダーはまだありません。</p>
      ) : null}
      {folders.length > 0 ? (
        <ul className="folder-list" aria-label="フォルダー">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                className={
                  selected?.folder.id === folder.id ? "selected-folder" : ""
                }
                disabled={pending}
                type="button"
                onClick={() => void chooseFolder(folder.id)}
              >
                <span>
                  {folder.isPinned ? "固定：" : ""}
                  {folder.name}
                </span>
              </button>
              <div
                className="order-actions"
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
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="selected-content">
          <h3>{selected.folder.name}</h3>
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
            <ol className="bookmark-list">
              {selected.bookmarks.map((bookmark, index) => (
                <li key={bookmark.id}>
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
          )}
        </div>
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
