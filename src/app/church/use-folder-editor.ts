"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FolderSummary, SavedBookmarkView } from "@/domain/saved-content";
import { postJson, requestJson } from "./client-api";
import { useComponentLifetimeValue } from "./use-component-lifetime-value";

type SelectedFolder = {
  folder: FolderSummary;
  bookmarks: SavedBookmarkView[];
};

export function useFolderEditor({
  fetcher,
  folderId,
  onDeleted,
}: {
  fetcher: typeof fetch;
  folderId: string;
  onDeleted: () => void;
}) {
  const lifetimeFetcher = useComponentLifetimeValue(fetcher);
  const onDeletedRef = useRef(onDeleted);
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadSequenceRef = useRef(0);
  const runSequenceRef = useRef(0);

  useEffect(() => {
    onDeletedRef.current = onDeleted;
  }, [onDeleted]);

  const request = useCallback(
    <T>(body: object) => {
      return postJson<T>(
        lifetimeFetcher,
        "/api/saved-content",
        body,
        "saved content unavailable",
      );
    },
    [lifetimeFetcher],
  );

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    const value = await requestJson<SelectedFolder>(
      lifetimeFetcher,
      `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
      "saved content unavailable",
    );
    if (sequence !== loadSequenceRef.current) return;
    setSelected(value);
    setName(value.folder.name);
  }, [folderId, lifetimeFetcher]);

  const run = useCallback(
    async (action: () => Promise<void>, success?: string) => {
      const sequence = ++runSequenceRef.current;
      setPending(true);
      setError("");
      setMessage("");
      try {
        await action();
        if (sequence === runSequenceRef.current && success) setMessage(success);
      } catch {
        if (sequence === runSequenceRef.current)
          setError(
            "保存内容を更新できませんでした。再読み込みしてお試しください。",
          );
      } finally {
        if (sequence === runSequenceRef.current) setPending(false);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() => run(load));
  }, [load, run]);

  const save = useCallback(async () => {
    if (!name.trim() || !selected) return;
    await run(async () => {
      await request({
        action: "update-folder",
        folderId,
        isPinned: selected.folder.isPinned,
        name: name.trim(),
      });
      await load();
    }, "フォルダーを更新しました。");
  }, [folderId, load, name, request, run, selected]);

  const deleteFolder = useCallback(async () => {
    if (!selected) return;
    await run(async () => {
      await request({ action: "delete-folder", folderId });
      onDeletedRef.current();
    });
  }, [folderId, request, run, selected]);

  const deleteBookmark = useCallback(
    async (bookmarkId: string) => {
      await run(async () => {
        await request({ action: "delete-bookmark", bookmarkId });
        await load();
      }, "お気に入りを削除しました。");
    },
    [load, request, run],
  );

  const reorderBookmarks = useCallback(
    async (ids: string[]) => {
      await run(async () => {
        await request({ action: "reorder-bookmarks", folderId, ids });
        await load();
      });
    },
    [folderId, load, request, run],
  );

  return {
    deleteBookmark,
    deleteFolder,
    error,
    message,
    name,
    pending,
    reorderBookmarks,
    save,
    selected,
    setName,
  };
}
