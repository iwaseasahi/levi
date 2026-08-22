"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  const currentRef = useRef<ScriptureSearchItem | null>(null);
  const authorizedRef = useRef(true);
  const navigationQueue = useRef(Promise.resolve());
  const openerRef = useRef<Window | null>(null);
  const readySentRef = useRef(false);
  const screenRef = useRef<HTMLElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);

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
        if (!response.ok) throw new Error("search unavailable");
        const result = (await response.json()) as {
          items: ScriptureSearchItem[];
        };
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
          if (!response.ok) throw new Error("navigation unavailable");
          const result = (await response.json()) as {
            edge: ScriptureNavigationEdge | null;
            item: ScriptureSearchItem | null;
          };
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

  useLayoutEffect(() => {
    const screen = screenRef.current;
    const verse = verseRef.current;
    if (!current || !screen || !verse) return;
    const activeScreen = screen;
    const activeVerse = verse;
    function fitVerse() {
      activeScreen.style.setProperty("--audience-fit-scale", "1");
      const headingHeight =
        activeScreen.querySelector<HTMLElement>(".audience-book-name")
          ?.offsetHeight ?? 26;
      const availableHeight = Math.max(
        1,
        activeScreen.clientHeight - headingHeight * 2,
      );
      let scale = 1;
      while (
        (activeVerse.scrollHeight > availableHeight ||
          activeVerse.scrollWidth > activeScreen.clientWidth) &&
        scale > 0.2
      ) {
        scale *= 0.95;
        activeScreen.style.setProperty("--audience-fit-scale", String(scale));
      }
    }
    fitVerse();
    window.addEventListener("resize", fitVerse);
    return () => window.removeEventListener("resize", fitVerse);
  }, [current, fontScale]);

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
      className="audience-screen"
      ref={screenRef}
      style={
        {
          "--audience-fit-scale": 1,
          "--audience-scale": fontScale,
        } as React.CSSProperties
      }
    >
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
      {message ? <p className="audience-navigation-error">{message}</p> : null}
    </main>
  );
}
