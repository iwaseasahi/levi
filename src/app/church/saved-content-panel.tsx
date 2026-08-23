"use client";

import {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { moveBy, moveTo } from "@/domain/order";
import { FavoritePortal } from "./favorite-portal";
import { useSavedContentController } from "./use-saved-content-controller";

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
  const controller = useSavedContentController({
    currentSearch,
    currentSearchTitle,
    fetcher,
    onOpen,
  });
  const [newFolderDate, setNewFolderDate] = useState("");
  const [newFolderMeeting, setNewFolderMeeting] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [draggedBookmarkId, setDraggedBookmarkId] = useState<string | null>(
    null,
  );
  const [dragOverBookmarkId, setDragOverBookmarkId] = useState<string | null>(
    null,
  );
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controller.error) feedbackRef.current?.focus();
  }, [controller.error]);

  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const meeting = newFolderMeeting.trim();
    if (!meeting) return;
    const name = [newFolderDate.trim(), meeting].filter(Boolean).join(" ");
    if (await controller.createFolder(name)) {
      setNewFolderDate("");
      setNewFolderMeeting("");
      setNewFolderOpen(false);
    }
  }

  async function saveFavorite(event: FormEvent) {
    event.preventDefault();
    await controller.saveFavorite();
  }

  async function reorderBookmarkTo(draggedId: string, targetId: string) {
    if (!controller.selected) return;
    const ids = moveTo(
      controller.selected.bookmarks.map(({ id }) => id),
      draggedId,
      targetId,
    );
    setDraggedBookmarkId(null);
    setDragOverBookmarkId(null);
    if (ids) await controller.reorderBookmarks(ids);
  }

  async function reorderBookmark(bookmarkId: string, offset: -1 | 1) {
    if (!controller.selected) return;
    const ids = moveBy(
      controller.selected.bookmarks.map(({ id }) => id),
      bookmarkId,
      offset,
    );
    if (ids) await controller.reorderBookmarks(ids);
  }

  function beginBookmarkDrag(
    event: DragEvent<HTMLLIElement>,
    bookmarkId: string,
  ) {
    if (controller.pending) return;
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

  const selected = controller.selected;
  const favoriteForm = (
    <form className="ginmaku-add-bookmark" onSubmit={saveFavorite}>
      <button
        disabled={controller.pending || !selected || !currentSearch}
        type="submit"
      >
        お気に入りに追加
      </button>
      {!selected ? <span> フォルダーを選択してください。</span> : null}
    </form>
  );

  return (
    <>
      <section
        className="saved-content"
        aria-label="フォルダーとお気に入り"
        aria-busy={controller.pending}
      >
        {controller.folders.length > 0 ? (
          <div className="folder-list" role="list" aria-label="フォルダー">
            {controller.folders.map((folder) => {
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
                    disabled={controller.pending}
                    type="button"
                    onClick={() => void controller.chooseFolder(folder.id)}
                  >
                    <span
                      aria-hidden="true"
                      className="folder-toggle-indicator"
                    >
                      {open ? "▾" : "▸"}
                    </span>
                    <span>{folder.name}</span>
                  </button>
                  {open && selected ? (
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
                              draggable={!controller.pending}
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
                                  void controller.openBookmark(bookmark.id);
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

        <div className="new-folder-action">
          <button
            aria-controls="new-folder-form"
            aria-expanded={newFolderOpen}
            className="new-folder-toggle"
            disabled={controller.pending}
            onClick={() => setNewFolderOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true">＋</span> 新規フォルダ作成
          </button>
        </div>
        {newFolderOpen ? (
          <form
            className="new-folder-form"
            id="new-folder-form"
            onSubmit={createFolder}
          >
            <div>
              <label htmlFor="new-folder-date">日付</label>
              <input
                autoFocus
                disabled={controller.pending}
                id="new-folder-date"
                type="date"
                value={newFolderDate}
                onChange={(event) => setNewFolderDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-folder-meeting">集会名</label>
              <input
                disabled={controller.pending}
                id="new-folder-meeting"
                maxLength={189}
                value={newFolderMeeting}
                onChange={(event) => setNewFolderMeeting(event.target.value)}
              />
            </div>
            <button
              disabled={controller.pending || !newFolderMeeting.trim()}
              type="submit"
            >
              作成
            </button>
          </form>
        ) : null}

        <p className="edit-folder-action">
          <a href="/folders">
            フォルダの一覧 <span aria-hidden="true">→</span>
          </a>
        </p>

        <div className="saved-feedback" aria-live="polite">
          {controller.error ? (
            <div
              className="notice notice-error"
              role="alert"
              tabIndex={-1}
              ref={feedbackRef}
            >
              {controller.error}
            </div>
          ) : null}
        </div>
      </section>
      <FavoritePortal>{favoriteForm}</FavoritePortal>
    </>
  );
}
