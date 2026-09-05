"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import {
  DEFAULT_SCRIPTURE_FONT_SCALE,
  SCRIPTURE_FONT_SCALE_OPTIONS,
  readScriptureFontScale,
  scriptureFontScalePercentage,
  subscribeScriptureFontScale,
  writeScriptureFontScale,
} from "@/app/church/scripture-font-scale";

export function DefaultSettingsForm() {
  const defaultFontScale = useSyncExternalStore(
    subscribeScriptureFontScale,
    readScriptureFontScale,
    () => DEFAULT_SCRIPTURE_FONT_SCALE,
  );
  const [saved, setSaved] = useState(false);

  function changeDefaultFontScale(value: string) {
    writeScriptureFontScale(Number(value));
    setSaved(true);
  }

  return (
    <div className="auth-form default-settings-form">
      <label htmlFor="scripture-default-font-scale">
        聖書投影のデフォルト文字サイズ
      </label>
      <select
        id="scripture-default-font-scale"
        onChange={(event) => changeDefaultFontScale(event.target.value)}
        value={defaultFontScale}
      >
        {SCRIPTURE_FONT_SCALE_OPTIONS.map((scale) => (
          <option key={scale} value={scale}>
            {scriptureFontScalePercentage(scale)}
          </option>
        ))}
      </select>
      <p className="default-settings-help">
        次に開く聖書箇所の投映画面から適用されます。
      </p>
      {saved ? (
        <p className="default-settings-saved" role="status">
          デフォルト文字サイズを保存しました。
        </p>
      ) : null}
      <Link className="auth-form-footer-link" href="/scripture">
        聖書検索へ戻る
      </Link>
    </div>
  );
}
