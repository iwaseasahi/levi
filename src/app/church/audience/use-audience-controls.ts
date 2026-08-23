"use client";

import { useEffect, useRef, useState } from "react";
import type { ScriptureSearchItem } from "@/domain/scripture/search";
import {
  directAudienceSchema,
  directAudienceVersion,
  isTrustedDirectAudienceEvent,
  parseDirectAudienceCommand,
  type DirectAudienceReady,
} from "@/domain/projection/direct-audience-control";
import type { AudienceDirection, AudienceStatus } from "./use-audience-data";

export function useAudienceControls({
  current,
  isAuthorized,
  navigate,
  status,
}: {
  current: ScriptureSearchItem | null;
  isAuthorized: () => boolean;
  navigate: (direction: AudienceDirection) => void;
  status: AudienceStatus;
}) {
  const [fontScale, setFontScale] = useState(1);
  const [blank, setBlank] = useState(false);
  const openerRef = useRef<Window | null>(null);
  const readySentRef = useRef(false);

  useEffect(() => {
    openerRef.current = window.opener as Window | null;
    function receiveControl(event: MessageEvent) {
      if (
        !isAuthorized() ||
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
        setFontScale((scale) =>
          Math.min(2.2, Number((scale + 0.1).toFixed(1))),
        );
      } else if (command.action === "font-smaller") {
        setFontScale((scale) =>
          Math.max(0.6, Number((scale - 0.1).toFixed(1))),
        );
      } else if (command.action === "toggle-blank") {
        setBlank((value) => !value);
      } else {
        navigate(command.action);
      }
    }
    window.addEventListener("message", receiveControl);
    return () => window.removeEventListener("message", receiveControl);
  }, [isAuthorized, navigate]);

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

  return { blank, fontScale };
}
