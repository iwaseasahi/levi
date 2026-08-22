"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ScriptureBookmarkView } from "@/domain/saved-content";

type SelectedFolder = {
  bookmarks: ScriptureBookmarkView[];
};

async function payload<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error("saved content unavailable");
  return body;
}

export function BookmarkEditPanel({
  bookmarkId,
  folderId,
  fetcher = fetch,
}: {
  bookmarkId: string;
  folderId: string;
  fetcher?: typeof fetch;
}) {
  const [bookmark, setBookmark] = useState<ScriptureBookmarkView | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const selected = await payload<SelectedFolder>(
      await fetcher(
        `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      ),
    );
    const value = selected.bookmarks.find(({ id }) => id === bookmarkId);
    if (!value) throw new Error("bookmark unavailable");
    setBookmark(value);
    setTitle(value.title);
  }

  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => setError("お気に入りを読み込めませんでした。"))
      .finally(() => setPending(false));
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkId, folderId]);

  async function update(event: FormEvent) {
    event.preventDefault();
    if (!bookmark || !title.trim()) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetcher("/api/saved-content", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update-bookmark",
          bookmarkId,
          title: title.trim(),
        }),
      });
      const result = await payload<{ bookmark: ScriptureBookmarkView }>(
        response,
      );
      setBookmark(result.bookmark);
      setTitle(result.bookmark.title);
      setMessage("お気に入りを更新しました。");
    } catch {
      setError("お気に入りを更新できませんでした。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="ginmaku-management-page">
      <h1>Editing bookmark</h1>
      {bookmark ? (
        <form onSubmit={update}>
          <label htmlFor="bookmark-title">Title</label>
          <br />
          <input
            disabled={pending}
            id="bookmark-title"
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <br />
          <button disabled={pending || !title.trim()} type="submit">
            更新
          </button>
        </form>
      ) : null}
      <p>
        <a href={`/folders/${folderId}/edit`}>Back</a>
      </p>
      <div aria-live="polite">
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </div>
    </main>
  );
}
