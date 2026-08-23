"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScriptureSearch } from "@/domain/scripture/search";
import {
  directAudienceSchema,
  directAudienceVersion,
  isTrustedDirectAudienceEvent,
  parseDirectAudienceReady,
  type DirectAudienceCommand,
} from "@/domain/projection/direct-audience-control";

function audienceUrl(search: ScriptureSearch) {
  return `/scripture/audience?${new URLSearchParams({
    book: search.book,
    chapter: String(search.chapter),
    endVerse: String(search.endVerse),
    language: search.language,
    startVerse: String(search.startVerse),
  })}`;
}

export function useDirectAudienceController() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const audienceWindow = useRef<Window | null>(null);

  useEffect(() => {
    function receiveAudienceReady(event: MessageEvent) {
      if (
        !isTrustedDirectAudienceEvent(
          event,
          window.location.origin,
          audienceWindow.current,
        ) ||
        !parseDirectAudienceReady(event.data)
      )
        return;
      setReady(true);
      setError("");
    }

    const closedWindowCheck = window.setInterval(() => {
      const target = audienceWindow.current;
      if (!target || !target.closed) return;
      audienceWindow.current = null;
      setReady(false);
    }, 1_000);
    window.addEventListener("message", receiveAudienceReady);
    return () => {
      window.clearInterval(closedWindowCheck);
      window.removeEventListener("message", receiveAudienceReady);
    };
  }, []);

  const open = useCallback((search: ScriptureSearch) => {
    const target = window.open(audienceUrl(search), "projector");
    if (!target) {
      setError(
        "聖書投映画面を開けませんでした。Chromeで新しいタブを許可してください。",
      );
      return;
    }
    audienceWindow.current = target;
    setReady(false);
    setError("");
  }, []);

  const control = useCallback(
    (action: DirectAudienceCommand["action"]) => {
      const target = audienceWindow.current;
      if (!target || target.closed || !ready) {
        audienceWindow.current = null;
        setReady(false);
        setError("先にOpenで聖書投映画面を開いてください。");
        return;
      }
      const command: DirectAudienceCommand = {
        action,
        schema: directAudienceSchema,
        type: "CONTROL",
        version: directAudienceVersion,
      };
      try {
        target.postMessage(command, window.location.origin);
        setError("");
      } catch {
        audienceWindow.current = null;
        setReady(false);
        setError("聖書投映画面を操作できませんでした。再度Openしてください。");
      }
    },
    [ready],
  );

  return {
    clearError: useCallback(() => setError(""), []),
    control,
    error,
    open,
    ready,
  };
}
