"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  initialProjectionControlState,
  isTrustedProjectionEvent,
  parseAudienceProjectionMessage,
  projectionSchema,
  projectionVersion,
  reduceAudienceConnection,
  reduceProjectionControl,
  type AudienceConnection,
  type ControllerProjectionMessage,
  type ProjectionControlEvent,
} from "@/domain/projection/state";
import type {
  ScriptureSearch,
  ScriptureSearchItem,
} from "@/domain/scripture/search";
import type { ScriptureNavigationEdge } from "@/domain/scripture/navigation";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: ScriptureSearchItem[] };

const connectionLabels: Record<AudienceConnection, string> = {
  blocked: "会衆向け画面の新しいタブがブロックされました。",
  closed: "会衆向け画面は閉じています。",
  connected: "会衆向け画面と接続しています。",
  disconnected: "会衆向け画面との通信が途切れています。再表示してください。",
  opening: "会衆向け画面の接続を待っています。",
};

function reference(item: ScriptureSearchItem) {
  const text = item.texts.japanese ?? item.texts.english;
  return `${text?.bookName ?? item.location.book} ${item.location.chapter}:${item.location.verse}`;
}

function audienceHeading(item: ScriptureSearchItem) {
  const bookNames = [
    item.texts.japanese?.bookName,
    item.texts.english?.bookName,
  ].filter((bookName): bookName is string => Boolean(bookName));
  return `新改訳聖書第3版 ${bookNames.join(" / ")} : ${item.location.chapter}`;
}

export function ProjectionController({
  selection,
}: {
  selection: ScriptureSearch;
}) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [connection, setConnection] = useState<AudienceConnection>("closed");
  const [syncNonce, setSyncNonce] = useState(0);
  const [currentItem, setCurrentItem] = useState<ScriptureSearchItem | null>(
    null,
  );
  const [navigationError, setNavigationError] = useState("");
  const [navigationEdges, setNavigationEdges] = useState<
    Record<"previous" | "next", boolean>
  >({ next: false, previous: false });
  const [control, dispatchControl] = useReducer(
    (
      state: typeof initialProjectionControlState,
      event: ProjectionControlEvent,
    ) =>
      reduceProjectionControl(
        state,
        event,
        loadState.kind === "ready" ? loadState.items.length : 0,
      ),
    initialProjectionControlState,
  );
  const audienceWindow = useRef<Window | null>(null);
  const lastHeartbeat = useRef(0);
  const revision = useRef(0);
  const sessionId = useRef("");
  const currentItemRef = useRef<ScriptureSearchItem | null>(null);
  const navigationQueue = useRef(Promise.resolve());
  const audienceNavigation = useRef<(direction: "previous" | "next") => void>(
    () => undefined,
  );

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    void Promise.resolve().then(async () => {
      try {
        const query = new URLSearchParams({
          book: selection.book,
          chapter: String(selection.chapter),
          startVerse: String(selection.startVerse),
          endVerse: String(selection.endVerse),
          language: selection.language,
        });
        const response = await fetch(`/api/scripture/search?${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("projection search unavailable");
        const result = (await response.json()) as {
          items: ScriptureSearchItem[];
        };
        if (result.items.length === 0)
          throw new Error("projection search empty");
        currentItemRef.current = result.items[0]!;
        setCurrentItem(result.items[0]!);
        setLoadState({ kind: "ready", items: result.items });
      } catch {
        setLoadState({
          kind: "error",
          message:
            "投影する御言葉を読み込めませんでした。検索画面から再度お試しください。",
        });
      }
    });
  }, [selection]);

  useEffect(() => {
    async function verifySession() {
      try {
        const response = await fetch("/api/church/session", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.ok) return;
      } catch {
        // Fail closed: protected controls and text cannot survive uncertainty.
      }
      const target = audienceWindow.current;
      if (target && !target.closed && sessionId.current) {
        const message: ControllerProjectionMessage = {
          schema: projectionSchema,
          sessionId: sessionId.current,
          type: "CLEAR",
          version: projectionVersion,
        };
        target.postMessage(message, window.location.origin);
      }
      setConnection("disconnected");
      setLoadState({
        kind: "error",
        message:
          "セッションを確認できないため、投影操作と本文の表示を終了しました。",
      });
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
  }, []);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        !isTrustedProjectionEvent(
          event,
          window.location.origin,
          audienceWindow.current,
        )
      )
        return;
      const message = parseAudienceProjectionMessage(event.data);
      if (!message) return;
      if (
        (message.type === "PONG" || message.type === "NAVIGATE") &&
        message.sessionId !== sessionId.current
      )
        return;
      lastHeartbeat.current = Date.now();
      if (message.type === "READY") setSyncNonce((value) => value + 1);
      if (message.type === "NAVIGATE")
        audienceNavigation.current(message.direction);
      setConnection((state) => reduceAudienceConnection(state, "ready"));
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const target = audienceWindow.current;
      if (!target || target.closed) {
        if (target?.closed) audienceWindow.current = null;
        setConnection((state) => reduceAudienceConnection(state, "closed"));
        return;
      }
      if (Date.now() - lastHeartbeat.current > 4_000)
        setConnection((state) => reduceAudienceConnection(state, "timeout"));
      const message: ControllerProjectionMessage = {
        schema: projectionSchema,
        sessionId: sessionId.current,
        type: "PING",
        version: projectionVersion,
      };
      target.postMessage(message, window.location.origin);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (connection !== "connected" || loadState.kind !== "ready") return;
    const target = audienceWindow.current;
    if (!target || target.closed) return;
    const item = currentItem;
    if (!item) return;
    revision.current += 1;
    const message: ControllerProjectionMessage = {
      schema: projectionSchema,
      type: "STATE",
      version: projectionVersion,
      payload: {
        blank: control.blank,
        fontScale: control.fontScale,
        heading: audienceHeading(item),
        revision: revision.current,
        scrollDirection: control.scrollDirection,
        scrollRevision: control.scrollRevision,
        sessionId: sessionId.current,
        verseNumber: item.location.verse,
        translations: [
          ...(item.texts.japanese
            ? [
                {
                  language: "ja" as const,
                  text: item.texts.japanese.text,
                },
              ]
            : []),
          ...(item.texts.english
            ? [
                {
                  language: "en" as const,
                  text: item.texts.english.text,
                },
              ]
            : []),
        ],
      },
    };
    target.postMessage(message, window.location.origin);
  }, [connection, control, currentItem, loadState, syncNonce]);

  function selectItem(item: ScriptureSearchItem, index: number) {
    currentItemRef.current = item;
    setCurrentItem(item);
    setNavigationEdges({ next: false, previous: false });
    setNavigationError("");
    dispatchControl({ type: "mark-current", index });
  }

  function queueNavigation(direction: "previous" | "next") {
    navigationQueue.current = navigationQueue.current.then(async () => {
      const current = currentItemRef.current;
      const readyState = loadState;
      if (!current || readyState.kind !== "ready") return;
      try {
        const query = new URLSearchParams({
          book: current.location.book,
          chapter: String(current.location.chapter),
          verse: String(current.location.verse),
          direction,
          language: selection.language,
        });
        const response = await fetch(`/api/scripture/navigate?${query}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (response.status === 401 || response.status === 403) {
          const target = audienceWindow.current;
          if (target && !target.closed && sessionId.current) {
            const message: ControllerProjectionMessage = {
              schema: projectionSchema,
              sessionId: sessionId.current,
              type: "CLEAR",
              version: projectionVersion,
            };
            target.postMessage(message, window.location.origin);
          }
          setConnection("disconnected");
          setLoadState({
            kind: "error",
            message:
              "セッションを確認できないため、投影操作と本文の表示を終了しました。",
          });
          return;
        }
        if (!response.ok) throw new Error("scripture navigation unavailable");
        const result = (await response.json()) as {
          edge: ScriptureNavigationEdge | null;
          item: ScriptureSearchItem | null;
        };
        if (!result.item) {
          setNavigationEdges((edges) => ({
            ...edges,
            [direction]: true,
          }));
          return;
        }
        currentItemRef.current = result.item;
        setCurrentItem(result.item);
        setNavigationEdges({ next: false, previous: false });
        setNavigationError("");
        const index = readyState.items.findIndex(
          ({ location }) =>
            location.book === result.item!.location.book &&
            location.chapter === result.item!.location.chapter &&
            location.verse === result.item!.location.verse,
        );
        dispatchControl({ type: "mark-current", index });
      } catch {
        setNavigationError(
          "前後の御言葉へ移動できませんでした。もう一度お試しください。",
        );
      }
    });
  }

  useEffect(() => {
    audienceNavigation.current = queueNavigation;
  });

  function openAudience() {
    const target = window.open("/church/audience", "_blank");
    if (!target) {
      setConnection((state) => reduceAudienceConnection(state, "blocked"));
      return;
    }
    audienceWindow.current = target;
    lastHeartbeat.current = Date.now();
    setConnection((state) => reduceAudienceConnection(state, "open"));
  }

  if (loadState.kind === "loading")
    return (
      <main className="shell">
        <p role="status">投影する御言葉を読み込んでいます。</p>
      </main>
    );
  if (loadState.kind === "error")
    return (
      <main className="shell">
        <div className="notice notice-error" role="alert">
          <p>{loadState.message}</p>
        </div>
      </main>
    );

  const current = currentItem;
  if (!current)
    return (
      <main className="shell">
        <p role="status">投影する御言葉を読み込んでいます。</p>
      </main>
    );
  return (
    <main
      className="projection-controller"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") queueNavigation("previous");
        if (event.key === "ArrowRight") queueNavigation("next");
      }}
    >
      <header className="controller-header">
        <div>
          <p className="eyebrow">Projection controller</p>
          <h1>投影操作</h1>
          <p className="current-reference">{reference(current)}</p>
        </div>
        <div
          className={`connection-state connection-${connection}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" />
          {connectionLabels[connection]}
        </div>
      </header>

      <section className="controller-actions" aria-label="投影操作">
        <button className="primary-button" type="button" onClick={openAudience}>
          {connection === "closed" || connection === "blocked"
            ? "会衆向け画面を新しいタブで開く"
            : "会衆向け画面を新しいタブで再表示"}
        </button>
        <div className="button-group">
          <button
            className="secondary-button"
            type="button"
            aria-keyshortcuts="ArrowLeft"
            disabled={navigationEdges.previous}
            onClick={() => queueNavigation("previous")}
          >
            前へ
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-keyshortcuts="ArrowRight"
            disabled={navigationEdges.next}
            onClick={() => queueNavigation("next")}
          >
            次へ
          </button>
        </div>
        <div className="button-group">
          <button
            className="secondary-button"
            type="button"
            onClick={() => dispatchControl({ type: "font-smaller" })}
          >
            文字を小さく
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => dispatchControl({ type: "font-larger" })}
          >
            文字を大きく
          </button>
        </div>
        <div className="button-group">
          <button
            className="secondary-button"
            type="button"
            onClick={() => dispatchControl({ type: "scroll", direction: "up" })}
          >
            上へスクロール
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              dispatchControl({ type: "scroll", direction: "down" })
            }
          >
            下へスクロール
          </button>
        </div>
        <button
          className={`blank-button ${control.blank ? "is-blank" : ""}`}
          type="button"
          aria-pressed={control.blank}
          onClick={() => dispatchControl({ type: "toggle-blank" })}
        >
          {control.blank ? "投影を再開" : "画面を暗転"}
        </button>
      </section>

      {navigationError ? (
        <div className="notice notice-error" role="alert">
          <p>{navigationError}</p>
        </div>
      ) : null}

      <section className="controller-grid">
        <nav className="projection-index" aria-label="検索結果から直接移動">
          <ol>
            {loadState.items.map((item, index) => (
              <li
                key={`${item.location.book}-${item.location.chapter}-${item.location.verse}`}
              >
                <button
                  type="button"
                  aria-current={
                    index === control.currentIndex ? "true" : undefined
                  }
                  onClick={() => selectItem(item, index)}
                >
                  {reference(item)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <article className="controller-preview">
          <p className="preview-state">
            {control.blank
              ? "会衆向け画面：暗転中"
              : `会衆向け画面：表示中・文字 ${Math.round(control.fontScale * 100)}%`}
          </p>
          <h2>{reference(current)}</h2>
          {current.texts.japanese ? (
            <>
              <p className="translation-name">新改訳聖書第3版（JSS3）</p>
              <p>{current.texts.japanese.text}</p>
            </>
          ) : null}
          {current.texts.english ? (
            <div lang="en">
              <p className="translation-name">New King James Version (NKJV)</p>
              <p>{current.texts.english.text}</p>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
