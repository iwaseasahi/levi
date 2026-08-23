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
      router.replace("/scripture");
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

  function beginDrag(
    event: DragEvent<HTMLTableRowElement>,
    bookmarkId: string,
  ) {
    if (pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bookmarkId);
    setDraggedId(bookmarkId);
  }

  return (
    <main className="ginmaku-management-page">
      <h1>お気に入りの編集(EDITING FOLDER)</h1>
      {selected ? (
        <>
          <form className="ginmaku-folder-edit-form" onSubmit={updateFolder}>
            <label htmlFor="folder-name">Title</label>
            <br />
            <input
              disabled={pending}
              id="folder-name"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <br />
            <label htmlFor="folder-pinned">Sticky</label>{" "}
            <input
              checked={pinned}
              disabled={pending}
              id="folder-pinned"
              type="checkbox"
              onChange={(event) => setPinned(event.target.checked)}
            />
            <br />
            <button disabled={pending || !name.trim()} type="submit">
              更新
            </button>
          </form>

          <h3>content</h3>
          <table className="ginmaku-folder-content-table">
            <tbody>
              {selected.bookmarks.map((bookmark) => (
                <tr
                  className={
                    dragOverId === bookmark.id
                      ? "bookmark-drop-target"
                      : draggedId === bookmark.id
                        ? "bookmark-dragging"
                        : undefined
                  }
                  data-bookmark-id={bookmark.id}
                  draggable={!pending}
                  key={bookmark.id}
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
                  <td>{bookmark.title}</td>
                  <td>
                    [
                    <a
                      href={`/bookmarks/${bookmark.id}/edit?folderId=${folderId}`}
                    >
                      編集/edit
                    </a>
                    ]
                  </td>
                  <td>
                    [
                    <button
                      className="ginmaku-link-button"
                      disabled={pending}
                      type="button"
                      onClick={() => void deleteBookmark(bookmark)}
                    >
                      削除/del
                    </button>
                    ]
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            <button
              className="ginmaku-link-button danger-link"
              disabled={pending}
              type="button"
              onClick={() => void deleteFolder()}
            >
              フォルダーを削除
            </button>{" "}
            | <a href="/scripture">Back</a>
          </p>
        </>
      ) : null}

      <div className="saved-feedback" aria-live="polite">
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
        {message ? <p role="status">{message}</p> : null}
      </div>
    </main>
  );
}
