"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import { createSlideAudienceSession } from "@/application/slides/project-slide";
import type { ProjectionAction } from "@/domain/projection/transport";
import type { SlideRecord } from "@/domain/slides/commands";
import type { SlideAudienceState } from "@/domain/slides/projection";

export function useSlideAudienceData(
  id: string,
  initialPage: number,
  providedFetcher: typeof fetch,
) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const [state, setState] = useState<SlideAudienceState>({
    status: "loading",
    pages: [],
    page: initialPage,
    revision: null,
  });
  const session = useRef<ReturnType<typeof createSlideAudienceSession> | null>(
    null,
  );
  useEffect(() => {
    const current = createSlideAudienceSession({
      id,
      initialPage,
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
      pageChanged(page) {
        const url = new URL(window.location.href);
        url.searchParams.set("page", String(page));
        window.history.replaceState(null, "", url);
      },
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
  }, [id, initialPage, fetcher]);
  const navigate = useCallback((command: ProjectionAction) => {
    if (command.action === "previous" || command.action === "next")
      void session.current?.navigate(command.action);
    else if (command.action === "select-page")
      void session.current?.navigate(command.page);
  }, []);
  return {
    state,
    navigate,
    isAuthorized: useCallback(
      () => session.current?.isAuthorized() ?? false,
      [],
    ),
    invalidate: useCallback(() => session.current?.invalidate(), []),
  };
}
