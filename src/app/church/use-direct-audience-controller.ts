"use client";

import { useCallback } from "react";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { parseScriptureProjectionState } from "@/domain/scripture/projection-state";
import type { DirectAudienceCommand } from "@/domain/projection/direct-audience-control";
import { useProjectionController } from "@/app/projection/use-projection-controller";

export function useDirectAudienceController() {
  const projection = useProjectionController(
    "scripture",
    parseScriptureProjectionState,
    { captureInputArrows: true },
  );
  const { open: openProjection, control: controlProjection } = projection;
  const open = useCallback(
    (search: ScriptureSearch) =>
      openProjection(
        `/scripture/audience?${new URLSearchParams({ book: search.book, chapter: String(search.chapter), endVerse: String(search.endVerse), language: search.language, startVerse: String(search.startVerse) })}`,
      ),
    [openProjection],
  );
  const control = useCallback(
    (action: DirectAudienceCommand["action"]) => controlProjection({ action }),
    [controlProjection],
  );
  return { ...projection, open, control };
}
