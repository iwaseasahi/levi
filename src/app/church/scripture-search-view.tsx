"use client";

import {
  useEffect,
  useRef,
  type FormEventHandler,
  type ReactNode,
} from "react";
import type {
  ScriptureCatalogBook,
  ScriptureLanguage,
} from "@/domain/scripture/search";
import type { DirectAudienceCommand } from "@/domain/projection/direct-audience-control";
import type { ScriptureSelection } from "./scripture-search-selection";
import { scriptureFontScalePercentage } from "./scripture-font-scale";

type SearchFieldsProps = {
  audienceReady: boolean;
  books: ScriptureCatalogBook[];
  catalogError: string;
  children?: ReactNode;
  fontScale: number;
  loading: boolean;
  onBookChange: (book: string) => void;
  onChapterChange: (chapter: string) => void;
  onControl: (action: DirectAudienceCommand["action"]) => void;
  onEndVerseChange: (endVerse: string) => void;
  onLanguageChange: (language: ScriptureLanguage) => void;
  onReset: () => void;
  onStartVerseChange: (startVerse: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  selection: ScriptureSelection;
};

export function ScriptureSearchFields({
  audienceReady,
  books,
  catalogError,
  children,
  fontScale,
  loading,
  onBookChange,
  onChapterChange,
  onControl,
  onEndVerseChange,
  onLanguageChange,
  onReset,
  onStartVerseChange,
  onSubmit,
  selection,
}: SearchFieldsProps) {
  const pending = loading;
  return (
    <form className="scripture-search-form" onSubmit={onSubmit}>
      <fieldset
        className="ginmaku-search-fields"
        disabled={pending || Boolean(catalogError)}
      >
        <legend className="sr-only">御言葉の検索条件</legend>
        <div className="scripture-search-layout">
          <div className="scripture-books-region">
            <table className="books ginmaku-books-table">
              <tbody>
                {Array.from({ length: 22 }, (_, rowIndex) => (
                  <tr key={rowIndex}>
                    {[0, 22, 44].map((offset) => {
                      const book = books[rowIndex + offset];
                      if (!book) return <td key={offset} />;
                      const names = [
                        book.japaneseName,
                        book.englishName,
                      ].filter((name): name is string => Boolean(name));
                      const label =
                        names.length > 0 ? names.join("/") : book.name;
                      return (
                        <td key={book.code}>
                          <label className="ginmaku-book-choice">
                            <input
                              checked={selection.book === book.code}
                              name="scripture-book"
                              onChange={() => onBookChange(book.code)}
                              type="radio"
                              value={book.code}
                            />
                            {label}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            aria-label="投影操作"
            className="projection-control-panel ginmaku-direct-controls"
            role="group"
          >
            <p className="projection-control-title">投影操作</p>
            <div className="projection-control-group">
              <span>
                文字サイズ
                <output
                  aria-label="現在の文字サイズ"
                  className="projection-font-scale"
                >
                  {scriptureFontScalePercentage(fontScale)}
                </output>
              </span>
              <div className="projection-control-buttons">
                <button
                  aria-label="文字を大きく"
                  disabled={!audienceReady}
                  onClick={() => onControl("font-larger")}
                  type="button"
                >
                  +
                </button>
                <button
                  aria-label="文字を小さく"
                  disabled={!audienceReady}
                  onClick={() => onControl("font-smaller")}
                  type="button"
                >
                  -
                </button>
              </div>
            </div>
            <div className="projection-control-group ginmaku-scroll-controls">
              <span>聖書箇所</span>
              <div className="projection-control-buttons">
                <button
                  aria-label="前の御言葉へ"
                  disabled={!audienceReady}
                  onClick={() => onControl("previous")}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label="次の御言葉へ"
                  disabled={!audienceReady}
                  onClick={() => onControl("next")}
                  type="button"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
          <div className="ginmaku-search-toolbar">
            <div className="scripture-search-console">
              <div className="scripture-range-fields">
                <label>
                  <input
                    aria-label="章"
                    disabled={!selection.book || loading}
                    inputMode="numeric"
                    onChange={(event) => onChapterChange(event.target.value)}
                    pattern="[0-9]*"
                    size={3}
                    type="text"
                    value={selection.chapter}
                  />
                  <span>章(chapter)</span>
                </label>
                <label>
                  <input
                    aria-label="開始節"
                    disabled={!selection.chapter || loading}
                    inputMode="numeric"
                    onChange={(event) => onStartVerseChange(event.target.value)}
                    pattern="[0-9]*"
                    size={4}
                    type="text"
                    value={selection.startVerse}
                  />
                  <span>節(verse)</span>
                </label>
                <span aria-hidden="true" className="range-separator">
                  〜
                </span>
                <label>
                  <input
                    aria-label="終了節（省略可）"
                    disabled={!selection.startVerse || loading}
                    inputMode="numeric"
                    onChange={(event) => onEndVerseChange(event.target.value)}
                    pattern="[0-9]*"
                    size={4}
                    type="text"
                    value={selection.endVerse}
                  />
                  <span>節(verse)</span>
                </label>
              </div>
              <div
                aria-label="表示言語"
                className="scripture-language-options"
                role="group"
              >
                {[
                  ["both", "日本語 & English"],
                  ["ja", "日本語のみ"],
                  ["en", "English Only"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={selection.language === value}
                      name="scripture-language"
                      onChange={() =>
                        onLanguageChange(value as ScriptureLanguage)
                      }
                      type="radio"
                      value={value}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="scripture-search-actions">
                <button
                  className="search-action-primary"
                  disabled={pending || Boolean(catalogError)}
                  type="submit"
                >
                  Open
                </button>
                <button
                  className="search-action-secondary"
                  type="button"
                  onClick={onReset}
                >
                  Reset
                </button>
                <button
                  aria-label="空白と表示を切り替え"
                  className="search-action-blank"
                  disabled={!audienceReady}
                  onClick={() => onControl("toggle-blank")}
                  type="button"
                >
                  空白⇔表示
                </button>
              </div>
              <div id="ginmaku-add-bookmark-slot" />
            </div>
          </div>
        </div>
      </fieldset>
      {children}
    </form>
  );
}

export function ScriptureSearchFeedback({
  books,
  catalogError,
  interactionError,
  loading,
  onRetry,
}: {
  books: ScriptureCatalogBook[];
  catalogError: string;
  interactionError: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (catalogError || interactionError) feedbackRef.current?.focus();
  }, [catalogError, interactionError]);

  return (
    <div className="search-feedback" aria-live="polite">
      {loading ? (
        <p className="sr-only" role="status">
          検索候補を読み込んでいます。
        </p>
      ) : null}
      {catalogError ? (
        <div
          className="notice notice-error"
          role="alert"
          tabIndex={-1}
          ref={feedbackRef}
        >
          <p>{catalogError}</p>
          <button className="secondary-button" type="button" onClick={onRetry}>
            再読み込み
          </button>
        </div>
      ) : null}
      {!loading && !catalogError && books.length === 0 ? (
        <p role="status">利用できる聖書データがありません。</p>
      ) : null}
      {interactionError ? (
        <div
          className="notice notice-error"
          role="alert"
          tabIndex={-1}
          ref={feedbackRef}
        >
          <p>{interactionError}</p>
        </div>
      ) : null}
    </div>
  );
}
