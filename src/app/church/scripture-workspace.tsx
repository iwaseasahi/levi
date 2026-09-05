"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ScriptureSelection } from "./scripture-search-selection";
import {
  DEFAULT_SCRIPTURE_FONT_SCALE,
  readScriptureFontScale,
  subscribeScriptureFontScale,
  writeScriptureFontScale,
} from "./scripture-font-scale";
import { ScriptureSearch } from "./scripture-search";
import { ScriptureSettingsMenu } from "./scripture-settings-menu";

export function ScriptureWorkspace({
  initialSelection,
}: {
  initialSelection: ScriptureSelection;
}) {
  const defaultFontScale = useSyncExternalStore(
    subscribeScriptureFontScale,
    readScriptureFontScale,
    () => DEFAULT_SCRIPTURE_FONT_SCALE,
  );

  const updateDefaultFontScale = useCallback((scale: number) => {
    writeScriptureFontScale(scale);
  }, []);

  return (
    <>
      <ScriptureSearch
        defaultFontScale={defaultFontScale}
        initialSelection={initialSelection}
      />
      <ScriptureSettingsMenu
        defaultFontScale={defaultFontScale}
        onDefaultFontScaleChange={updateDefaultFontScale}
      />
    </>
  );
}
