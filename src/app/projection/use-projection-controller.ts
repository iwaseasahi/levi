"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseProjectionMessage,
  projectionArrow,
  projectionEnvelope,
  trustedProjectionEvent,
  type PresentationState,
  type ProjectionAction,
  type ProjectionKind,
} from "@/domain/projection/transport";

type Connection = {
  target: Window;
  generation: string;
  challenge: string;
  instance: string | null;
  pendingInstance: string | null;
  received: number;
  sent: number;
  lastSeen: number;
  missedHeartbeat: boolean;
  retired: Set<string>;
};
export function useProjectionController<T>(
  kind: ProjectionKind,
  parseContent: (value: unknown) => T | null,
  {
    captureInputArrows = false,
    canControl,
    keyboardNavigation = true,
  }: {
    captureInputArrows?: boolean;
    canControl?: (content: T) => boolean;
    keyboardNavigation?: boolean;
  } = {},
) {
  const connection = useRef<Connection | null>(null);
  const [state, setState] = useState<{
    presentation: PresentationState;
    content: T;
  } | null>(null);
  const [error, setError] = useState("");
  const ready =
    !!state?.presentation.ready &&
    state.presentation.authorized &&
    (canControl?.(state.content) ?? true);
  const disconnect = useCallback((message: string) => {
    setState(null);
    setError(message);
  }, []);
  const probe = useCallback(
    (peer: Connection) => {
      peer.challenge = crypto.randomUUID();
      peer.target.postMessage(
        {
          ...projectionEnvelope(kind, peer.generation),
          type: "CONNECT",
          challenge: peer.challenge,
        },
        window.location.origin,
      );
    },
    [kind],
  );
  useEffect(() => {
    function receive(event: MessageEvent) {
      const peer = connection.current;
      if (
        !peer ||
        !trustedProjectionEvent(event, window.location.origin, peer.target)
      )
        return;
      const message = parseProjectionMessage(event.data);
      if (
        !message ||
        message.kind !== kind ||
        message.generation !== peer.generation
      )
        return;
      if (message.type === "HELLO") {
        if (
          message.instance === peer.instance ||
          peer.retired.has(message.instance)
        )
          return;
        if (peer.pendingInstance && peer.pendingInstance !== message.instance)
          peer.retired.add(peer.pendingInstance);
        peer.pendingInstance = message.instance;
        disconnect("");
        try {
          probe(peer);
        } catch {
          disconnect("投映画面に接続できません。再度Openしてください。");
        }
        return;
      }
      if (message.type !== "ACK" && message.type !== "READY") return;
      const content = parseContent(message.content);
      if (content === null) return;
      if (message.type === "READY") {
        if (
          message.challenge !== peer.challenge ||
          peer.retired.has(message.instance) ||
          (peer.pendingInstance !== null &&
            peer.pendingInstance !== message.instance)
        )
          return;
        if (message.instance !== peer.instance) {
          if (peer.instance) peer.retired.add(peer.instance);
          peer.instance = message.instance;
          peer.received = -1;
          peer.sent = 0;
        }
        peer.pendingInstance = null;
      } else if (
        peer.pendingInstance !== null ||
        message.instance !== peer.instance
      )
        return;
      if (message.sequence <= peer.received) return;
      if (message.type === "READY") peer.challenge = "";
      peer.received = message.sequence;
      peer.lastSeen = Date.now();
      peer.missedHeartbeat = false;
      setState({ presentation: message.presentation, content });
      setError(
        message.presentation.authorized
          ? ""
          : "表示の利用資格を確認できません。再度Openしてください。",
      );
    }
    const timer = window.setInterval(() => {
      const peer = connection.current;
      if (!peer) return;
      if (peer.target.closed) {
        connection.current = null;
        disconnect("");
        return;
      }
      try {
        probe(peer);
      } catch {
        // A closing WindowProxy can reject a probe before `closed` settles.
        // The heartbeat below reports a live but unreachable peer after its
        // existing grace period, without flashing an error for a closed tab.
      }
      if (peer.target.closed) {
        connection.current = null;
        disconnect("");
        return;
      }
      if (Date.now() - peer.lastSeen > 5_000) {
        if (peer.missedHeartbeat)
          disconnect(
            "投映画面との接続を確認できません。両画面を更新して再度Openしてください。",
          );
        peer.missedHeartbeat = true;
      }
    }, 1_000);
    window.addEventListener("message", receive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("message", receive);
    };
  }, [kind, parseContent, probe, disconnect]);
  const open = useCallback(
    (url: string) => {
      connection.current = null;
      setState(null);
      setError("");
      const generation = crypto.randomUUID();
      const target = window.open(`${url}#levi=${generation}`, "projector");
      if (!target) {
        setError(
          "投映画面を開けませんでした。Chromeで新しいタブを許可してください。",
        );
        return;
      }
      try {
        // Reusing the named tab from another controller must transfer its opener.
        target.opener = window;
        const peer = {
          target,
          generation,
          challenge: "",
          instance: null,
          pendingInstance: null,
          received: -1,
          sent: 0,
          lastSeen: Date.now(),
          missedHeartbeat: false,
          retired: new Set<string>(),
        };
        connection.current = peer;
        probe(peer);
      } catch {
        disconnect("投映画面に接続できません。再度Openしてください。");
      }
    },
    [probe, disconnect],
  );
  const control = useCallback(
    (command: ProjectionAction) => {
      const peer = connection.current;
      if (!peer || peer.target.closed || !peer.instance || !ready) {
        disconnect("先にOpenで投映画面を開いてください。");
        return;
      }
      try {
        peer.target.postMessage(
          {
            ...projectionEnvelope(kind, peer.generation),
            type: "CONTROL",
            instance: peer.instance,
            sequence: ++peer.sent,
            command,
          },
          window.location.origin,
        );
      } catch {
        disconnect("投映画面を操作できませんでした。再度Openしてください。");
      }
    },
    [ready, kind, disconnect],
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!keyboardNavigation) return;
      const action = projectionArrow(event, captureInputArrows);
      if (!ready || !action) return;
      event.preventDefault();
      control({ action });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [control, ready, captureInputArrows, keyboardNavigation]);
  return {
    open,
    control,
    ready,
    error,
    state,
    clearError: useCallback(() => setError(""), []),
  };
}
