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

  useEffect(() => {
    let active = true;

    void fetcher(
      `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    )
      .then((response) => payload<SelectedFolder>(response))
      .then((selected) => {
        const value = selected.bookmarks.find(({ id }) => id === bookmarkId);
        if (!value) throw new Error("bookmark unavailable");
        if (!active) return;
        setBookmark(value);
        setTitle(value.title);
      })
      .catch(() => {
        if (active) setError("お気に入りを読み込めませんでした。");
      })
      .finally(() => {
        if (active) setPending(false);
      });

    return () => {
      active = false;
    };
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkId, folderId]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedTitle = String(
      new FormData(event.currentTarget).get("title") ?? "",
    ).trim();
    if (!bookmark || !submittedTitle) return;
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
          title: submittedTitle,
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
    <main className="folder-management-page">
      <div className="folder-management-shell folder-management-shell-narrow">
        <a className="management-back-link" href={`/folders/${folderId}/edit`}>
          <span aria-hidden="true">←</span> フォルダー編集へ
        </a>

        <header className="folder-page-header">
          <h1>お気に入りを編集</h1>
        </header>

        {bookmark ? (
          <section className="management-card">
            <form className="modern-bookmark-edit-form" onSubmit={update}>
              <div className="management-field">
                <label htmlFor="bookmark-title">お気に入り名</label>
                <input
                  disabled={pending}
                  id="bookmark-title"
                  maxLength={200}
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <small>聖書箇所の内容は変更されません。</small>
              </div>
              <button
                className="primary-button"
                disabled={pending || !title.trim()}
                type="submit"
              >
                変更を保存
              </button>
            </form>
          </section>
        ) : pending ? (
          <div
            className="management-card management-loading"
            aria-label="読み込み中"
          />
        ) : null}

        <div className="management-feedback" aria-live="polite">
          {error ? (
            <div className="notice notice-error" role="alert">
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
