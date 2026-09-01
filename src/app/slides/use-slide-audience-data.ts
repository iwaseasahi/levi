"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import { createSlideAudienceSession } from "@/application/slides/project-slide";
import type { SlideRecord } from "@/domain/slides/commands";
import type { SlideAudienceState } from "@/domain/slides/projection";

export function useSlideAudienceData(
  id: string,
  providedFetcher: typeof fetch,
) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const [state, setState] = useState<SlideAudienceState>({
    status: "loading",
    text: null,
    revision: null,
  });
  const session = useRef<ReturnType<typeof createSlideAudienceSession> | null>(
    null,
  );
  useEffect(() => {
    const current = createSlideAudienceSession({
      id,
      load: async () =>
        (
          await requestJson<{ slide: SlideRecord }>(
            fetcher,
            `/api/church/slides/${id}`,
            { cache: "no-store" },
            "SLIDE_UNAVAILABLE",
          )
        ).slide,
      publish: setState,
    });
    session.current = current;
    void current.start();
    const timer = window.setInterval(() => void current.verify(), 30_000);
    const visible = () => {
      if (document.visibilityState === "visible") void current.verify();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      current.dispose();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      if (session.current === current) session.current = null;
    };
  }, [id, fetcher]);
  return {
    state,
    isAuthorized: useCallback(
      () => session.current?.isAuthorized() ?? false,
      [],
    ),
    invalidate: useCallback(() => session.current?.invalidate(), []),
  };
}
