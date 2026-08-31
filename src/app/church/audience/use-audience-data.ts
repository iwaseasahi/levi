"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScriptureNavigationEdge } from "@/domain/scripture/navigation";
import type {
  ScriptureSearch,
  ScriptureSearchItem,
} from "@/domain/scripture/search";
import { parseJsonResponse } from "../client-api";

export type AudienceStatus = "loading" | "ready" | "error";
export type AudienceDirection = "previous" | "next";

export function useAudienceData(selection: ScriptureSearch) {
  const [current, setCurrent] = useState<ScriptureSearchItem | null>(null);
  const [status, setStatus] = useState<AudienceStatus>("loading");
  const [message, setMessage] = useState("");
  const currentRef = useRef<ScriptureSearchItem | null>(null);
  const authorizedRef = useRef(true);
  const navigationQueue = useRef(Promise.resolve());

  const failClosed = useCallback(() => {
    authorizedRef.current = false;
    currentRef.current = null;
    setCurrent(null);
    setStatus("error");
    setMessage("セッションを確認できないため、表示を終了しました。");
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        const query = new URLSearchParams({
          book: selection.book,
          chapter: String(selection.chapter),
          endVerse: String(selection.endVerse),
          language: selection.language,
          startVerse: String(selection.startVerse),
        });
        const response = await fetch(`/api/scripture/search?${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          failClosed();
          return;
        }
        const result = await parseJsonResponse<{
          items: ScriptureSearchItem[];
        }>(response, "search unavailable");
        const first = result.items[0];
        if (!first) throw new Error("search empty");
        if (!active || !authorizedRef.current) return;
        currentRef.current = first;
        setCurrent(first);
        setStatus("ready");
      } catch {
        if (!active || !authorizedRef.current) return;
        setStatus("error");
        setMessage("投影する御言葉を読み込めませんでした。");
      }
    });
    return () => {
      active = false;
    };
  }, [failClosed, selection]);

  useEffect(() => {
    async function verifySession() {
      try {
        const response = await fetch("/api/church/session", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.ok) return;
      } catch {
        // Fail closed: connectivity loss cannot preserve protected text.
      }
      failClosed();
    }
    const timer = window.setInterval(() => void verifySession(), 30_000);
    function verifyWhenVisible() {
      if (document.visibilityState === "visible") void verifySession();
    }
    document.addEventListener("visibilitychange", verifyWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", verifyWhenVisible);
    };
  }, [failClosed]);

  const navigate = useCallback(
    (direction: AudienceDirection) => {
      navigationQueue.current = navigationQueue.current.then(async () => {
        const item = currentRef.current;
        if (!item || !authorizedRef.current) return;
        try {
          const query = new URLSearchParams({
            book: item.location.book,
            chapter: String(item.location.chapter),
            direction,
            language: selection.language,
            verse: String(item.location.verse),
          });
          const response = await fetch(`/api/scripture/navigate?${query}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (response.status === 401 || response.status === 403) {
            failClosed();
            return;
          }
          const result = await parseJsonResponse<{
            edge: ScriptureNavigationEdge | null;
            item: ScriptureSearchItem | null;
          }>(response, "navigation unavailable");
          if (!result.item || !authorizedRef.current) return;
          currentRef.current = result.item;
          setCurrent(result.item);
          setMessage("");
        } catch {
          if (authorizedRef.current)
            setMessage("前後の御言葉へ移動できませんでした。");
        }
      });
    },
    [failClosed, selection.language],
  );

  return {
    current,
    failClosed,
    isAuthorized: useCallback(() => authorizedRef.current, []),
    message,
    navigate,
    status,
  };
}
