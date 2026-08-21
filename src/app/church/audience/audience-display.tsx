"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isTrustedProjectionEvent,
  parseControllerProjectionMessage,
  projectionSchema,
  projectionVersion,
  type AudienceProjectionMessage,
  type AudienceProjectionState,
} from "@/domain/projection/state";

export function AudienceDisplay() {
  const [display, setDisplay] = useState<AudienceProjectionState | null>(null);
  const [authorized, setAuthorized] = useState(true);
  const opener = useRef<Window | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);
  const authorizedRef = useRef(true);
  const lastRevision = useRef(-1);
  const lastScrollRevision = useRef(-1);

  useEffect(() => {
    opener.current = window.opener as Window | null;
    const target = opener.current;
    if (target) {
      const ready: AudienceProjectionMessage = {
        schema: projectionSchema,
        type: "READY",
        version: projectionVersion,
      };
      target.postMessage(ready, window.location.origin);
    }

    function receive(event: MessageEvent) {
      if (
        !isTrustedProjectionEvent(event, window.location.origin, opener.current)
      )
        return;
      const message = parseControllerProjectionMessage(event.data);
      if (!message) return;
      if (message.type === "CLEAR") {
        setDisplay(null);
        return;
      }
      if (message.type === "PING") {
        const pong: AudienceProjectionMessage = {
          schema: projectionSchema,
          sessionId: message.sessionId,
          type: "PONG",
          version: projectionVersion,
        };
        opener.current?.postMessage(pong, window.location.origin);
        return;
      }
      if (!authorizedRef.current) return;
      if (message.payload.revision <= lastRevision.current) return;
      lastRevision.current = message.payload.revision;
      setDisplay(message.payload);
      const pong: AudienceProjectionMessage = {
        schema: projectionSchema,
        sessionId: message.payload.sessionId,
        type: "PONG",
        version: projectionVersion,
      };
      opener.current?.postMessage(pong, window.location.origin);
    }

    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

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
      authorizedRef.current = false;
      setAuthorized(false);
      setDisplay(null);
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
    if (
      !display?.scrollDirection ||
      display.scrollRevision <= lastScrollRevision.current
    )
      return;
    lastScrollRevision.current = display.scrollRevision;
    displayRef.current?.scrollBy({
      behavior: "smooth",
      top:
        display.scrollDirection === "down"
          ? window.innerHeight * 0.65
          : window.innerHeight * -0.65,
    });
  }, [display]);

  useLayoutEffect(() => {
    const screen = displayRef.current;
    const verse = verseRef.current;
    if (!display || display.blank || !screen || !verse) return;

    function fitVerse(screenElement: HTMLElement, verseElement: HTMLElement) {
      screenElement.style.setProperty("--audience-fit-scale", "1");
      const headingHeight =
        screenElement.querySelector<HTMLElement>(".audience-book-name")
          ?.offsetHeight ?? 26;
      const availableHeight = Math.max(
        1,
        screenElement.clientHeight - headingHeight * 2,
      );
      let scale = 1;
      while (
        (verseElement.scrollHeight > availableHeight ||
          verseElement.scrollWidth > screenElement.clientWidth) &&
        scale > 0.2
      ) {
        scale *= 0.95;
        screenElement.style.setProperty("--audience-fit-scale", String(scale));
      }
    }

    const fitCurrentVerse = () => fitVerse(screen, verse);
    fitCurrentVerse();
    window.addEventListener("resize", fitCurrentVerse);
    return () => window.removeEventListener("resize", fitCurrentVerse);
  }, [display]);

  if (!authorized)
    return (
      <main className="audience-screen audience-waiting">
        <p>セッションを確認できないため、表示を終了しました。</p>
      </main>
    );
  if (!display)
    return (
      <main className="audience-screen audience-waiting">
        <p role="status">操作画面からの投影を待っています。</p>
      </main>
    );
  if (display.blank)
    return (
      <main className="audience-screen audience-blank" aria-label="暗転中" />
    );

  return (
    <main
      className="audience-screen"
      ref={displayRef}
      style={
        {
          "--audience-fit-scale": 1,
          "--audience-scale": display.fontScale,
        } as React.CSSProperties
      }
    >
      <h1 className="audience-book-name">{display.heading}</h1>
      <article className="audience-content">
        <div className="audience-verse" ref={verseRef}>
          {display.translations.map((translation) => (
            <p
              className="audience-book-word audience-shadow"
              key={translation.language}
              lang={translation.language}
            >
              <span className="audience-verse-number">
                {display.verseNumber}:
              </span>{" "}
              {translation.text}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}
