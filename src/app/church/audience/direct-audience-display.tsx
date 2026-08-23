"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ScriptureSearch,
  ScriptureSearchItem,
} from "@/domain/scripture/search";
import type { ScriptureNavigationEdge } from "@/domain/scripture/navigation";
import {
  directAudienceSchema,
  directAudienceVersion,
  isTrustedDirectAudienceEvent,
  parseDirectAudienceCommand,
  type DirectAudienceReady,
} from "@/domain/projection/direct-audience-control";
import { parseJsonResponse } from "../client-api";
import { useAudienceFit } from "./use-audience-fit";

function heading(item: ScriptureSearchItem) {
  const bookName =
    item.texts.japanese?.bookName ??
    item.texts.english?.bookName ??
    item.location.book;
  return `新改訳聖書第3版 ${bookName} ${item.location.chapter}:${item.location.verse}`;
}

export function DirectAudienceDisplay({
  selection,
}: {
  selection: ScriptureSearch;
}) {
  const [current, setCurrent] = useState<ScriptureSearchItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [fontScale, setFontScale] = useState(1);
  const [blank, setBlank] = useState(false);
  const currentRef = useRef<ScriptureSearchItem | null>(null);
  const authorizedRef = useRef(true);
  const navigationQueue = useRef(Promise.resolve());
  const openerRef = useRef<Window | null>(null);
  const readySentRef = useRef(false);
  const screenRef = useRef<HTMLElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);

  useAudienceFit({ blank, current, fontScale, screenRef, verseRef });

  const failClosed = useCallback(() => {
    authorizedRef.current = false;
    currentRef.current = null;
    setCurrent(null);
    setStatus("error");
    setMessage("セッションを確認できないため、表示を終了しました。");
  }, []);

  useEffect(() => {
    void Promise.resolve().then(async () => {
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
        if (response.status === 401 || response.status === 403) {
          failClosed();
          return;
        }
        const result = await parseJsonResponse<{
          items: ScriptureSearchItem[];
        }>(response, "search unavailable");
        const first = result.items[0];
        if (!first) throw new Error("search empty");
        currentRef.current = first;
        setCurrent(first);
        setStatus("ready");
      } catch {
        setStatus("error");
        setMessage("投影する御言葉を読み込めませんでした。");
      }
    });
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
    (direction: "previous" | "next") => {
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
          if (!result.item) return;
          currentRef.current = result.item;
          setCurrent(result.item);
          setMessage("");
        } catch {
          setMessage("前後の御言葉へ移動できませんでした。");
        }
      });
    },
    [failClosed, selection.language],
  );

  useEffect(() => {
    openerRef.current = window.opener as Window | null;
    function receiveControl(event: MessageEvent) {
      if (
        !authorizedRef.current ||
        !isTrustedDirectAudienceEvent(
          event,
          window.location.origin,
          openerRef.current,
        )
      )
        return;
      const command = parseDirectAudienceCommand(event.data);
      if (!command) return;
      if (command.action === "font-larger") {
        setFontScale((currentScale) =>
          Math.min(2.2, Number((currentScale + 0.1).toFixed(1))),
        );
      } else if (command.action === "font-smaller") {
        setFontScale((currentScale) =>
          Math.max(0.6, Number((currentScale - 0.1).toFixed(1))),
        );
      } else if (command.action === "toggle-blank") {
        setBlank((currentBlank) => !currentBlank);
      } else {
        navigate(command.action);
      }
    }

    window.addEventListener("message", receiveControl);
    return () => window.removeEventListener("message", receiveControl);
  }, [navigate]);

  useEffect(() => {
    const opener = openerRef.current;
    if (status !== "ready" || !current || !opener || readySentRef.current)
      return;
    const ready: DirectAudienceReady = {
      schema: directAudienceSchema,
      type: "READY",
      version: directAudienceVersion,
    };
    opener.postMessage(ready, window.location.origin);
    readySentRef.current = true;
  }, [current, status]);

  useEffect(() => {
    function navigateWithArrowKey(event: KeyboardEvent) {
      const direction =
        event.key === "ArrowUp"
          ? ("previous" as const)
          : event.key === "ArrowDown"
            ? ("next" as const)
            : null;
      if (!direction) return;
      event.preventDefault();
      navigate(direction);
    }
    window.addEventListener("keydown", navigateWithArrowKey);
    return () => window.removeEventListener("keydown", navigateWithArrowKey);
  }, [navigate]);

  if (status !== "ready" || !current)
    return (
      <main className="audience-screen audience-waiting">
        <p role={status === "error" ? "alert" : "status"}>
          {status === "loading"
            ? "投影する御言葉を読み込んでいます。"
            : message}
        </p>
      </main>
    );

  const translations = [
    ...(current.texts.japanese
      ? [{ language: "ja" as const, text: current.texts.japanese.text }]
      : []),
    ...(current.texts.english
      ? [{ language: "en" as const, text: current.texts.english.text }]
      : []),
  ];

  return (
    <main
      aria-label={blank ? "空白投影" : undefined}
      className={`audience-screen${blank ? " audience-blank" : ""}`}
      ref={screenRef}
      style={
        {
          "--audience-fit-scale": 1,
          "--audience-scale": fontScale,
        } as React.CSSProperties
      }
    >
      {blank ? null : (
        <>
          <h1 className="audience-book-name">{heading(current)}</h1>
          <article className="audience-content">
            <div className="audience-verse" ref={verseRef}>
              {translations.map((translation) => (
                <p
                  className="audience-book-word audience-shadow"
                  key={translation.language}
                  lang={translation.language}
                >
                  <span className="audience-verse-number">
                    {current.location.verse}:
                  </span>{" "}
                  {translation.text}
                </p>
              ))}
            </div>
          </article>
          {message ? (
            <p className="audience-navigation-error">{message}</p>
          ) : null}
        </>
      )}
    </main>
  );
}
