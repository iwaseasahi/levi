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
  received: number;
  sent: number;
  lastSeen: number;
};
export function useProjectionController<T>(
  kind: ProjectionKind,
  parseContent: (value: unknown) => T | null,
) {
  const connection = useRef<Connection | null>(null);
  const [state, setState] = useState<{
    presentation: PresentationState;
    content: T;
  } | null>(null);
  const [error, setError] = useState("");
  const ready = !!state?.presentation.ready && state.presentation.authorized;
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
        message.generation !== peer.generation ||
        (message.type !== "ACK" && message.type !== "READY")
      )
        return;
      const content = parseContent(message.content);
      if (content === null) return;
      if (message.type === "READY") {
        if (message.challenge !== peer.challenge) return;
        if (message.instance !== peer.instance) {
          peer.instance = message.instance;
          peer.received = -1;
          peer.sent = 0;
        }
      } else if (message.instance !== peer.instance) return;
      if (message.sequence <= peer.received) return;
      if (message.type === "READY") peer.challenge = "";
      peer.received = message.sequence;
      peer.lastSeen = Date.now();
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
        disconnect("投映画面を閉じました。再度Openしてください。");
        return;
      }
      if (Date.now() - peer.lastSeen > 5_000)
        disconnect(
          "投映画面との接続を確認できません。両画面を更新して再度Openしてください。",
        );
      try {
        probe(peer);
      } catch {
        disconnect("投映画面に接続できません。再度Openしてください。");
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
          received: -1,
          sent: 0,
          lastSeen: Date.now(),
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
      const action = projectionArrow(event);
      if (!ready || !action) return;
      event.preventDefault();
      control({ action });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [control, ready]);
  return {
    open,
    control,
    ready,
    error,
    state,
    clearError: useCallback(() => setError(""), []),
  };
}
