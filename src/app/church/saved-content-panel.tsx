"use client";

import {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
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

const subscribeToClient = () => () => {};

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { error?: { code?: string } };
  if (!response.ok) throw new Error("saved content unavailable");
  return body as T;
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

function move(ids: string[], id: string, offset: -1 | 1) {
  const from = ids.indexOf(id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

function bookmarkHref(search: ScriptureSearch) {
  return `/scripture/audience?${new URLSearchParams({
    book: search.book,
    chapter: String(search.chapter),
    endVerse: String(search.endVerse),
    language: search.language,
    startVerse: String(search.startVerse),
  })}`;
}

export function SavedContentPanel({
  currentSearch,
  currentSearchTitle,
  fetcher,
  onOpen,
}: {
  currentSearch: ScriptureSearch | null;
  currentSearchTitle: string;
  fetcher: typeof fetch;
  onOpen(search: ScriptureSearch): Promise<void>;
}) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [newFolderDate, setNewFolderDate] = useState("");
  const [newFolderMeeting, setNewFolderMeeting] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
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
  const isClient = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  const favoriteTarget = !isClient
    ? null
    : document.getElementById("ginmaku-add-bookmark-slot");

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

  async function fetchFolders() {
    const response = await payload<{ folders: FolderSummary[] }>(
      await fetcher("/api/saved-content", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    );
    setFolders(response.folders);
    return response.folders;
  }

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
    void Promise.resolve().then(() =>
      run(async () => {
        const initialFolders = await fetchFolders();
        if (initialFolders[0]) await loadFolder(initialFolders[0].id);
      }),
    );
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) feedbackRef.current?.focus();
  }, [error]);

  async function chooseFolder(folderId: string) {
    if (selected?.folder.id === folderId) {
      setSelected(null);
      return;
    }
    await run(async () => {
      await loadFolder(folderId);
      await fetchFolders();
    });
  }

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const meeting = newFolderMeeting.trim();
    if (!meeting) return;
    const name = [newFolderDate.trim(), meeting].filter(Boolean).join(" ");
    await run(async () => {
      const { folder } = await request<{ folder: FolderSummary }>({
        action: "create-folder",
        name,
      });
      setNewFolderDate("");
      setNewFolderMeeting("");
      setNewFolderOpen(false);
      await loadFolder(folder.id);
      await fetchFolders();
    });
  }

  async function saveFavorite(event: FormEvent) {
    event.preventDefault();
    if (!selected || !currentSearch) return;
    await run(async () => {
      await request({
        action: "create-bookmark",
        folderId: selected.folder.id,
        title: currentSearchTitle,
        ...currentSearch,
      });
      await loadFolder(selected.folder.id);
      await fetchFolders();
    }, "お気に入りに追加しました。");
  }

  async function openBookmark(bookmarkId: string) {
    await run(async () => {
      const { bookmark } = await request<{ bookmark: ScriptureBookmarkView }>({
        action: "open-bookmark",
        bookmarkId,
      });
      await onOpen(bookmark.search);
      await fetchFolders();
    });
  }

  async function persistBookmarkOrder(ids: string[]) {
    if (!selected) return;
    const folderId = selected.folder.id;
    await run(
      async () => {
        await request({ action: "reorder-bookmarks", folderId, ids });
        await loadFolder(folderId);
        await fetchFolders();
      },
      undefined,
      () => loadFolder(folderId),
    );
  }

  async function reorderBookmarkTo(draggedId: string, targetId: string) {
    if (!selected) return;
    const ids = moveTo(
      selected.bookmarks.map(({ id }) => id),
      draggedId,
      targetId,
    );
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
    if (ids) await persistBookmarkOrder(ids);
  }

  async function reorderBookmark(bookmarkId: string, offset: -1 | 1) {
    if (!selected) return;
    const ids = move(
      selected.bookmarks.map(({ id }) => id),
      bookmarkId,
      offset,
    );
    if (ids) await persistBookmarkOrder(ids);
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

  function handleBookmarkKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    bookmarkId: string,
  ) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown"))
      return;
    event.preventDefault();
    void reorderBookmark(bookmarkId, event.key === "ArrowUp" ? -1 : 1);
  }

  function finishBookmarkDrag() {
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
  }

  const favoriteForm = (
    <form className="ginmaku-add-bookmark" onSubmit={saveFavorite}>
      <button disabled={pending || !selected || !currentSearch} type="submit">
        お気に入りに追加
      </button>
      {!selected ? <span> フォルダーを選択してください。</span> : null}
      <div className="saved-feedback" aria-live="polite">
        {message ? <span role="status">{message}</span> : null}
      </div>
    </form>
  );

  return (
    <>
      <section
        className="saved-content"
        aria-label="フォルダーとお気に入り"
        aria-busy={pending}
      >
        {!pending && folders.length === 0 ? (
          <p className="empty-copy">フォルダーはまだありません。</p>
        ) : null}
        {folders.length > 0 ? (
          <div className="folder-list" role="list" aria-label="フォルダー">
            {folders.map((folder) => {
              const open = selected?.folder.id === folder.id;
              return (
                <div
                  className={`folder-item${open ? " is-open" : ""}`}
                  key={folder.id}
                  role="listitem"
                >
                  <button
                    aria-controls={`folder-content-${folder.id}`}
                    aria-expanded={open}
                    className={`folder-toggle${open ? " selected-folder" : ""}`}
                    disabled={pending}
                    type="button"
                    onClick={() => void chooseFolder(folder.id)}
                  >
                    <span
                      aria-hidden="true"
                      className="folder-toggle-indicator"
                    >
                      {open ? "▾" : "▸"}
                    </span>
                    <span>{folder.name}</span>
                  </button>
                  {open ? (
                    <div
                      className="selected-content"
                      id={`folder-content-${folder.id}`}
                    >
                      {selected.bookmarks.length === 0 ? null : (
                        <ul
                          className="bookmark-list"
                          aria-label="保存した聖書箇所"
                        >
                          {selected.bookmarks.map((bookmark) => (
                            <li
                              aria-label={`${bookmark.title}。Altと上下矢印で並べ替え`}
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
                              tabIndex={0}
                              onDragEnd={finishBookmarkDrag}
                              onDragEnter={() =>
                                setDragOverBookmarkId(bookmark.id)
                              }
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                              }}
                              onDragStart={(event) =>
                                beginBookmarkDrag(event, bookmark.id)
                              }
                              onDrop={(event) => {
                                event.preventDefault();
                                const draggedId =
                                  draggedBookmarkId ||
                                  event.dataTransfer.getData("text/plain");
                                if (draggedId)
                                  void reorderBookmarkTo(
                                    draggedId,
                                    bookmark.id,
                                  );
                              }}
                              onKeyDown={(event) =>
                                handleBookmarkKeyDown(event, bookmark.id)
                              }
                            >
                              <span
                                aria-hidden="true"
                                className="bookmark-document-icon"
                              />
                              <a
                                href={bookmarkHref(bookmark.search)}
                                target="projector"
                                onClick={(event) => {
                                  event.preventDefault();
                                  void openBookmark(bookmark.id);
                                }}
                              >
                                {bookmark.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <p className="new-folder-action">
          <span aria-hidden="true" className="ginmaku-action-icon">
            ⊕
          </span>
          <button
            aria-controls="new-folder-form"
            aria-expanded={newFolderOpen}
            className="new-folder-toggle"
            disabled={pending}
            onClick={() => setNewFolderOpen((open) => !open)}
            type="button"
          >
            新規フォルダ作成
          </button>
        </p>
        {newFolderOpen ? (
          <form
            className="new-folder-form"
            id="new-folder-form"
            onSubmit={createFolder}
          >
            <label htmlFor="new-folder-date">日付</label>{" "}
            <input
              autoFocus
              disabled={pending}
              id="new-folder-date"
              type="date"
              value={newFolderDate}
              onChange={(event) => setNewFolderDate(event.target.value)}
            />
            <br />
            <label htmlFor="new-folder-meeting">集会名</label>{" "}
            <input
              disabled={pending}
              id="new-folder-meeting"
              maxLength={189}
              size={22}
              value={newFolderMeeting}
              onChange={(event) => setNewFolderMeeting(event.target.value)}
            />
            <br />
            <button
              disabled={pending || !newFolderMeeting.trim()}
              type="submit"
            >
              作成
            </button>
          </form>
        ) : null}

        <p className="edit-folder-action">
          <span aria-hidden="true" className="ginmaku-action-icon">
            ▣
          </span>
          {selected ? (
            <a href={`/folders/${selected.folder.id}/edit`}>フォルダの編集</a>
          ) : (
            <span aria-disabled="true">フォルダの編集</span>
          )}
        </p>

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
        </div>
      </section>
      {favoriteTarget ? createPortal(favoriteForm, favoriteTarget) : null}
    </>
  );
}
