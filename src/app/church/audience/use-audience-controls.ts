"use client";

import { useCallback, useMemo } from "react";
import type { ScriptureSearchItem } from "@/domain/scripture/search";
import type { ProjectionAction } from "@/domain/projection/transport";
import { useProjectionAudience } from "@/app/projection/use-projection-audience";
import type { AudienceDirection, AudienceStatus } from "./use-audience-data";
import { readScriptureFontScale } from "../scripture-font-scale";

export function useAudienceControls({
  current,
  isAuthorized,
  navigate,
  status,
  invalidate,
}: {
  current: ScriptureSearchItem | null;
  isAuthorized: () => boolean;
  navigate: (direction: AudienceDirection) => void;
  status: AudienceStatus;
  invalidate: () => void;
}) {
  const initialFontScale = useMemo(() => readScriptureFontScale(), []);
  const content = useMemo(
    () => ({ location: current?.location ?? null }),
    [current],
  );
  const navigateCommand = useCallback(
    (command: ProjectionAction) => {
      if (command.action === "previous" || command.action === "next")
        navigate(command.action);
    },
    [navigate],
  );
  return useProjectionAudience({
    kind: "scripture",
    content,
    ready: status === "ready" && !!current,
    authorized: isAuthorized(),
    isAuthorized,
    initialFontScale,
    navigate: navigateCommand,
    invalidate,
  });
}
