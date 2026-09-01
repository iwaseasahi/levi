"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";

const favoriteErrorMessage =
  "お気に入りに追加できませんでした。再度お試しください。";

export function useSlideFavorite({
  fetcher,
  selectedFolderId,
  onFavoriteSaved,
}: {
  fetcher: typeof fetch;
  selectedFolderId: string | null;
  onFavoriteSaved: (() => void) | undefined;
}) {
  const lifetimeFetcher = useComponentLifetimeValue(fetcher);
  const callback = useRef(onFavoriteSaved);
  const mounted = useRef(true);
  const pendingId = useRef<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    callback.current = onFavoriteSaved;
  }, [onFavoriteSaved]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const save = useCallback(
    async (slideId: string) => {
      const folderId = selectedFolderId;
      if (!folderId || pendingId.current) return;
      pendingId.current = slideId;
      setSavingId(slideId);
      setError("");
      try {
        await postJson(
          lifetimeFetcher,
          "/api/saved-content",
          {
            action: "create-slide-bookmark",
            folderId,
            slideId,
          },
          "saved content unavailable",
        );
        if (mounted.current) callback.current?.();
      } catch {
        if (mounted.current) setError(favoriteErrorMessage);
      } finally {
        pendingId.current = null;
        if (mounted.current) setSavingId(null);
      }
    },
    [lifetimeFetcher, selectedFolderId],
  );

  return { error, save, savingId };
}
