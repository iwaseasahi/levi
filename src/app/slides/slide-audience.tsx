"use client";

import { useMemo } from "react";
import { useProjectionAudience } from "@/app/projection/use-projection-audience";
import {
  slideAudienceMessages,
  slideProjectionState,
} from "@/domain/slides/projection";
import { SlideText } from "./slide-text";
import { SlideImage } from "./slide-image";
import { useSlideAudienceData } from "./use-slide-audience-data";

const ignoreNavigation = () => undefined;

export function SlideAudience({
  id,
  fetcher = fetch,
}: {
  id: string;
  fetcher?: typeof fetch;
}) {
  const { state, isAuthorized, invalidate } = useSlideAudienceData(id, fetcher);
  const content = useMemo(() => slideProjectionState(id, state), [id, state]);
  const { fontScale, blank } = useProjectionAudience({
    kind: "slide",
    content,
    ready: state.status === "ready",
    authorized: state.status === "loading" || state.status === "ready",
    isAuthorized,
    keyboardNavigation: false,
    navigate: ignoreNavigation,
    invalidate,
  });
  return (
    <main
      className="slide-audience"
      aria-label={
        blank && state.status === "ready" ? "空白投影" : "スライド投影"
      }
    >
      {state.status === "loading" ? null : state.status === "ready" ? (
        state.contentType === "image" ? (
          <SlideImage
            src={`/api/church/slides/${id}/image?revision=${state.revision}`}
            title={state.title}
            blank={blank}
          />
        ) : (
          <SlideText
            text={state.text}
            document={state.document}
            fontScale={fontScale}
            blank={blank}
          />
        )
      ) : (
        <p role="alert">{slideAudienceMessages[state.status]}</p>
      )}
    </main>
  );
}
