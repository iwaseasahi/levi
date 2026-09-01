"use client";

import { useMemo } from "react";
import { useProjectionAudience } from "@/app/projection/use-projection-audience";
import {
  slideAudienceMessages,
  slideProjectionState,
} from "@/domain/slides/projection";
import { SlideText } from "./slide-text";
import { useSlideAudienceData } from "./use-slide-audience-data";

export function SlideAudience({
  id,
  page,
  fetcher = fetch,
}: {
  id: string;
  page: number;
  fetcher?: typeof fetch;
}) {
  const { state, navigate, isAuthorized, invalidate } = useSlideAudienceData(
    id,
    page,
    fetcher,
  );
  const content = useMemo(() => slideProjectionState(id, state), [id, state]);
  const { fontScale, blank } = useProjectionAudience({
    kind: "slide",
    content,
    ready: state.status === "ready",
    authorized: state.status === "loading" || state.status === "ready",
    isAuthorized,
    keyboardNavigation: false,
    navigate,
    invalidate,
  });
  return (
    <main
      className="slide-audience"
      aria-label={
        blank && state.status === "ready" ? "空白投影" : "スライド投影"
      }
    >
      {state.status === "ready" ? (
        <SlideText
          text={state.pages[state.page] ?? ""}
          fontScale={fontScale}
          blank={blank}
        />
      ) : (
        <p role={state.status === "loading" ? "status" : "alert"}>
          {slideAudienceMessages[state.status]}
        </p>
      )}
    </main>
  );
}
