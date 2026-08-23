"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { postJson, requestJson } from "./client-api";
import { useComponentLifetimeValue } from "./use-component-lifetime-value";

export type SelectedFolder = {
  folder: FolderSummary;
  bookmarks: ScriptureBookmarkView[];
};

export function useSavedContentController({
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
  const lifetimeFetcher = useComponentLifetimeValue(fetcher);
  const onOpenRef = useRef(onOpen);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

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

  const fetchFolders = useCallback(async () => {
    const response = await requestJson<{ folders: FolderSummary[] }>(
      lifetimeFetcher,
      "/api/saved-content",
      { cache: "no-store", headers: { Accept: "application/json" } },
      "saved content unavailable",
    );
    setFolders(response.folders);
    return response.folders;
  }, [lifetimeFetcher]);

  const loadFolder = useCallback(
    async (folderId: string) => {
      const value = await requestJson<SelectedFolder>(
        lifetimeFetcher,
        `/api/saved-content?folderId=${encodeURIComponent(folderId)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
        "saved content unavailable",
      );
      setSelected(value);
    },
    [lifetimeFetcher],
  );

  const run = useCallback(
    async (action: () => Promise<void>, recover?: () => Promise<void>) => {
      setPending(true);
      setError("");
      try {
        await action();
      } catch {
        if (recover) {
          try {
            await recover();
          } catch {
            // Preserve the original mutation failure when recovery also fails.
          }
        }
        setError(
          "保存内容を更新できませんでした。再読み込みしてお試しください。",
        );
      } finally {
        setPending(false);
      }
    },
    [],
  );

  useEffect(() => {
    void Promise.resolve().then(() =>
      run(async () => {
        const initialFolders = await fetchFolders();
        if (initialFolders[0]) await loadFolder(initialFolders[0].id);
      }),
    );
  }, [fetchFolders, loadFolder, run]);

  const chooseFolder = useCallback(
    async (folderId: string) => {
      if (selected?.folder.id === folderId) {
        setSelected(null);
        return;
      }
      await run(async () => {
        await loadFolder(folderId);
        await fetchFolders();
      });
    },
    [fetchFolders, loadFolder, run, selected?.folder.id],
  );

  const createFolder = useCallback(
    async (name: string) => {
      let created = false;
      await run(async () => {
        const { folder } = await request<{ folder: FolderSummary }>({
          action: "create-folder",
          name,
        });
        created = true;
        await loadFolder(folder.id);
        await fetchFolders();
      });
      return created;
    },
    [fetchFolders, loadFolder, request, run],
  );

  const saveFavorite = useCallback(async () => {
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
    });
  }, [
    currentSearch,
    currentSearchTitle,
    fetchFolders,
    loadFolder,
    request,
    run,
    selected,
  ]);

  const openBookmark = useCallback(
    async (bookmarkId: string) => {
      await run(async () => {
        const { bookmark } = await request<{
          bookmark: ScriptureBookmarkView;
        }>({ action: "open-bookmark", bookmarkId });
        await onOpenRef.current(bookmark.search);
        await fetchFolders();
      });
    },
    [fetchFolders, request, run],
  );

  const reorderBookmarks = useCallback(
    async (ids: string[]) => {
      if (!selected) return;
      const folderId = selected.folder.id;
      await run(
        async () => {
          await request({ action: "reorder-bookmarks", folderId, ids });
          await loadFolder(folderId);
          await fetchFolders();
        },
        () => loadFolder(folderId),
      );
    },
    [fetchFolders, loadFolder, request, run, selected],
  );

  return {
    chooseFolder,
    createFolder,
    error,
    folders,
    openBookmark,
    pending,
    reorderBookmarks,
    saveFavorite,
    selected,
  };
}
