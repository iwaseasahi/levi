"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseProjectionMessage,
  projectionArrow,
  projectionEnvelope,
  projectionGeneration,
  trustedProjectionEvent,
  type ProjectionAction,
  type ProjectionKind,
} from "@/domain/projection/transport";

export function useProjectionAudience({
  kind,
  content,
  ready,
  authorized,
  isAuthorized,
  navigate,
  invalidate,
}: {
  kind: ProjectionKind;
  content: unknown;
  ready: boolean;
  authorized: boolean;
  isAuthorized: () => boolean;
  navigate: (command: ProjectionAction) => void;
  invalidate: () => void;
}) {
  const [fontScale, setFontScale] = useState(1);
  const [blank, setBlank] = useState(false);
  const peer = useRef<{
    opener: Window | null;
    generation: string;
    instance: string;
    sent: number;
    received: number;
  } | null>(null);
  const snapshot = useRef({
    presentation: { ready, authorized, fontScale, blank },
    content,
  });
  const send = useCallback(
    (challenge?: string) => {
      const binding = peer.current;
      if (
        !binding?.opener ||
        projectionGeneration(window.location.hash) !== binding.generation
      )
        return;
      binding.opener.postMessage(
        {
          ...projectionEnvelope(kind, binding.generation),
          type: challenge ? "READY" : "ACK",
          ...(challenge ? { challenge } : {}),
          instance: binding.instance,
          sequence: ++binding.sent,
          ...snapshot.current,
        },
        window.location.origin,
      );
    },
    [kind],
  );
  useEffect(() => {
    snapshot.current = {
      presentation: { ready, authorized, fontScale, blank },
      content,
    };
    send();
  }, [content, ready, authorized, fontScale, blank, send]);
  useEffect(() => {
    const generation = projectionGeneration(window.location.hash);
    peer.current = generation
      ? {
          generation,
          opener: window.opener as Window | null,
          instance: crypto.randomUUID(),
          sent: 0,
          received: -1,
        }
      : null;
    function receive(event: MessageEvent) {
      const binding = peer.current;
      if (
        !binding ||
        projectionGeneration(window.location.hash) !== binding.generation ||
        !trustedProjectionEvent(event, window.location.origin, binding.opener)
      )
        return;
      const message = parseProjectionMessage(event.data);
      if (
        !message ||
        message.kind !== kind ||
        message.generation !== binding.generation
      )
        return;
      if (message.type === "CONNECT") {
        send(message.challenge);
        return;
      }
      if (
        message.type !== "CONTROL" ||
        message.instance !== binding.instance ||
        message.sequence <= binding.received ||
        !isAuthorized() ||
        !snapshot.current.presentation.ready
      )
        return;
      binding.received = message.sequence;
      const command = message.command;
      if (command.action === "font-larger")
        setFontScale((value) =>
          Math.min(2.2, Number((value + 0.1).toFixed(1))),
        );
      else if (command.action === "font-smaller")
        setFontScale((value) =>
          Math.max(0.6, Number((value - 0.1).toFixed(1))),
        );
      else if (command.action === "toggle-blank") setBlank((value) => !value);
      else navigate(command);
    }
    function changedGeneration() {
      invalidate();
      peer.current = null;
      window.location.reload();
    }
    window.addEventListener("message", receive);
    window.addEventListener("hashchange", changedGeneration);
    return () => {
      peer.current = null;
      window.removeEventListener("message", receive);
      window.removeEventListener("hashchange", changedGeneration);
    };
  }, [kind, isAuthorized, navigate, invalidate, send]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const action = projectionArrow(event);
      if (!action || !isAuthorized()) return;
      event.preventDefault();
      navigate({ action });
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [isAuthorized, navigate]);
  return { fontScale, blank };
}
