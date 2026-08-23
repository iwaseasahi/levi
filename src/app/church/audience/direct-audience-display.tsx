"use client";

import { useRef } from "react";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { AudienceView } from "./audience-view";
import { useAudienceControls } from "./use-audience-controls";
import { useAudienceData } from "./use-audience-data";
import { useAudienceFit } from "./use-audience-fit";

export function DirectAudienceDisplay({
  selection,
}: {
  selection: ScriptureSearch;
}) {
  const { current, isAuthorized, message, navigate, status } =
    useAudienceData(selection);
  const { blank, fontScale } = useAudienceControls({
    current,
    isAuthorized,
    navigate,
    status,
  });
  const screenRef = useRef<HTMLElement>(null);
  const verseRef = useRef<HTMLDivElement>(null);

  useAudienceFit({ blank, current, fontScale, screenRef, verseRef });

  return (
    <AudienceView
      blank={blank}
      current={current}
      fontScale={fontScale}
      message={message}
      screenRef={screenRef}
      status={status}
      verseRef={verseRef}
    />
  );
}
