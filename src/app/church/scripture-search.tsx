"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  ScriptureCatalog,
  ScriptureCatalogBook,
  ScriptureLanguage,
  ScriptureSearch as NormalizedSearch,
} from "@/domain/scripture/search";
import {
  directAudienceSchema,
  directAudienceVersion,
  isTrustedDirectAudienceEvent,
  parseDirectAudienceReady,
  type DirectAudienceCommand,
} from "@/domain/projection/direct-audience-control";
import { SavedContentPanel } from "./saved-content-panel";
import { requestJson } from "./client-api";

type Status = { kind: "idle" } | { kind: "error"; message: string };

type Selection = {
  book: string;
  chapter: string;
  startVerse: string;
  endVerse: string;
  language: ScriptureLanguage;
};

const initialSelection: Selection = {
  book: "",
  chapter: "",
  startVerse: "",
  endVerse: "",
  language: "both",
};

function catalogUrl(
  selection: Pick<Selection, "book" | "chapter" | "language">,
) {
  const query = new URLSearchParams({ language: selection.language });
  if (selection.book) query.set("book", selection.book);
  if (selection.chapter) query.set("chapter", selection.chapter);
  return `/api/scripture/catalog?${query}`;
}

function contiguousEndVerses(verses: number[], startVerse: string) {
  if (!startVerse) return [];
  const startIndex = verses.indexOf(Number(startVerse));
  if (startIndex < 0) return [];
  const candidates = [verses[startIndex]!];
  for (
    let index = startIndex + 1;
    index < verses.length && candidates.length < 500;
    index += 1
  ) {
    const verse = verses[index]!;
    if (verse !== candidates.at(-1)! + 1) break;
    candidates.push(verse);
  }
  return candidates;
}

function normalizedSearch(
  selection: Selection,
  chapters: number[],
  verses: number[],
): NormalizedSearch | null {
  if (!selection.book || !selection.chapter || !selection.startVerse)
    return null;
  const validEndVerses = contiguousEndVerses(verses, selection.startVerse);
  const chapter = Number(selection.chapter);
  const startVerse = Number(selection.startVerse);
  const endVerse = Number(
    selection.endVerse || String(validEndVerses.at(-1) ?? ""),
  );
  if (
    !chapters.includes(chapter) ||
    !verses.includes(startVerse) ||
    !validEndVerses.includes(endVerse)
  )
    return null;
  return {
    book: selection.book,
    chapter,
    endVerse,
    language: selection.language,
    startVerse,
  };
}

function audienceUrl(search: NormalizedSearch) {
  return `/scripture/audience?${new URLSearchParams({
    book: search.book,
    chapter: String(search.chapter),
    endVerse: String(search.endVerse),
    language: search.language,
    startVerse: String(search.startVerse),
  })}`;
}

function favoriteTitle(
  selection: Selection,
  search: NormalizedSearch | null,
  books: ScriptureCatalogBook[],
) {
  const book = books.find(({ code }) => code === selection.book);
  if (!book || !selection.chapter || !selection.startVerse) return "聖句検索";
  const names = [book.japaneseName, book.englishName].filter(
    (name): name is string => Boolean(name),
  );
  const displayedEndVerse =
    selection.endVerse ||
    (search && search.endVerse > search.startVerse
      ? String(search.endVerse)
      : "");
  const range = displayedEndVerse ? `-${displayedEndVerse}` : "";
  return `${names.length > 0 ? names.join("/") : book.name} ${selection.chapter}:${selection.startVerse}${range}`;
}

export function ScriptureSearch({
  fetcher = fetch,
  savedContentFetcher = fetcher,
}: {
  fetcher?: typeof fetch;
  savedContentFetcher?: typeof fetch;
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [books, setBooks] = useState<ScriptureCatalogBook[]>([]);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verses, setVerses] = useState<number[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [audienceReady, setAudienceReady] = useState(false);
  const requestSequence = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const audienceWindow = useRef<Window | null>(null);

  async function loadCatalog(next: Selection) {
    const sequence = ++requestSequence.current;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const catalog = await requestJson<ScriptureCatalog>(
        fetcher,
        catalogUrl(next),
        { cache: "no-store", headers: { Accept: "application/json" } },
        "catalog unavailable",
      );
      if (sequence !== requestSequence.current) return;
      setBooks(catalog.books);
      setChapters(catalog.chapters);
      setVerses(catalog.verses);
    } catch {
      if (sequence !== requestSequence.current) return;
      setBooks([]);
      setChapters([]);
      setVerses([]);
      setCatalogError(
        "検索候補を読み込めませんでした。しばらくしてから再度お試しください。",
      );
    } finally {
      if (sequence === requestSequence.current) setCatalogLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadCatalog(initialSelection));
    // The injected fetcher is fixed for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status.kind === "error") feedbackRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (catalogError) feedbackRef.current?.focus();
  }, [catalogError]);

  useEffect(() => {
    function receiveAudienceReady(event: MessageEvent) {
      if (
        !isTrustedDirectAudienceEvent(
          event,
          window.location.origin,
          audienceWindow.current,
        ) ||
        !parseDirectAudienceReady(event.data)
      )
        return;
      setAudienceReady(true);
      setStatus({ kind: "idle" });
    }

    const closedWindowCheck = window.setInterval(() => {
      const target = audienceWindow.current;
      if (!target || !target.closed) return;
      audienceWindow.current = null;
      setAudienceReady(false);
    }, 1_000);
    window.addEventListener("message", receiveAudienceReady);
    return () => {
      window.clearInterval(closedWindowCheck);
      window.removeEventListener("message", receiveAudienceReady);
    };
  }, []);

  function updateLanguage(language: ScriptureLanguage) {
    const next = { ...selection, language };
    setSelection(next);
    setStatus({ kind: "idle" });
    void loadCatalog(next);
  }

  function updateBook(book: string) {
    const next = {
      ...selection,
      book,
      chapter: "",
      startVerse: "",
      endVerse: "",
    };
    setSelection(next);
    setChapters([]);
    setVerses([]);
    setStatus({ kind: "idle" });
    if (book) void loadCatalog(next);
    else {
      requestSequence.current += 1;
      setCatalogLoading(false);
    }
  }

  function updateChapter(chapter: string) {
    const next = { ...selection, chapter, startVerse: "", endVerse: "" };
    setSelection(next);
    setVerses([]);
    setStatus({ kind: "idle" });
    if (chapter) void loadCatalog(next);
    else {
      requestSequence.current += 1;
      setCatalogLoading(false);
    }
  }

  function updateStartVerse(startVerse: string) {
    const endVerse =
      selection.endVerse &&
      !contiguousEndVerses(verses, startVerse).includes(
        Number(selection.endVerse),
      )
        ? startVerse
        : selection.endVerse;
    setSelection({ ...selection, startVerse, endVerse });
    setStatus({ kind: "idle" });
  }

  function openAudience(search: NormalizedSearch) {
    const target = window.open(audienceUrl(search), "projector");
    if (!target) {
      setStatus({
        kind: "error",
        message:
          "聖書投映画面を開けませんでした。Chromeで新しいタブを許可してください。",
      });
      return;
    }
    audienceWindow.current = target;
    setAudienceReady(false);
    setStatus({ kind: "idle" });
  }

  function controlAudience(action: DirectAudienceCommand["action"]) {
    const target = audienceWindow.current;
    if (!target || target.closed || !audienceReady) {
      audienceWindow.current = null;
      setAudienceReady(false);
      setStatus({
        kind: "error",
        message: "先にOpenで聖書投映画面を開いてください。",
      });
      return;
    }
    const command: DirectAudienceCommand = {
      action,
      schema: directAudienceSchema,
      type: "CONTROL",
      version: directAudienceVersion,
    };
    try {
      target.postMessage(command, window.location.origin);
      setStatus({ kind: "idle" });
    } catch {
      audienceWindow.current = null;
      setAudienceReady(false);
      setStatus({
        kind: "error",
        message: "聖書投映画面を操作できませんでした。再度Openしてください。",
      });
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingRequiredMessage = !selection.book
      ? "書巻を選択してください。"
      : !selection.chapter
        ? "章を入力してください。"
        : !selection.startVerse
          ? "開始節を入力してください。"
          : null;
    if (missingRequiredMessage) {
      setStatus({
        kind: "error",
        message: missingRequiredMessage,
      });
      return;
    }
    const search = normalizedSearch(selection, chapters, verses);
    if (!search) {
      setStatus({ kind: "error", message: "検索条件を確認してください。" });
      return;
    }
    openAudience(search);
  }

  function resetSearch() {
    setSelection(initialSelection);
    setStatus({ kind: "idle" });
    setChapters([]);
    setVerses([]);
    void loadCatalog(initialSelection);
  }

  async function reopenBookmark(search: NormalizedSearch) {
    openAudience(search);
  }

  const pending = catalogLoading;
  const currentSearch = normalizedSearch(selection, chapters, verses);

  return (
    <section className="ginmaku-search-workspace" aria-label="聖句検索">
      <h1 className="sr-only">聖句検索</h1>
      <div id="bookmark_container" className="ginmaku-bookmark-container">
        <SavedContentPanel
          currentSearch={currentSearch}
          currentSearchTitle={favoriteTitle(selection, currentSearch, books)}
          fetcher={savedContentFetcher}
          onOpen={reopenBookmark}
        />
      </div>

      <div id="index_container">
        <form className="scripture-search-form" onSubmit={submit}>
          <fieldset
            className="ginmaku-search-fields"
            disabled={pending || Boolean(catalogError)}
          >
            <legend className="sr-only">御言葉の検索条件</legend>
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
                              onChange={() => updateBook(book.code)}
                              type="radio"
                              value={book.code}
                            />
                            {label}
                          </label>
                        </td>
                      );
                    })}
                    {rowIndex === 0 ? (
                      <td className="ginmaku-direct-controls" rowSpan={23}>
                        <div
                          aria-label="投影操作"
                          className="projection-control-panel"
                          role="group"
                        >
                          <p className="projection-control-title">投影操作</p>
                          <div className="projection-control-group">
                            <span>文字サイズ</span>
                            <div className="projection-control-buttons">
                              <button
                                aria-label="文字を大きく"
                                disabled={!audienceReady}
                                onClick={() => controlAudience("font-larger")}
                                type="button"
                              >
                                大
                              </button>
                              <button
                                aria-label="文字を小さく"
                                disabled={!audienceReady}
                                onClick={() => controlAudience("font-smaller")}
                                type="button"
                              >
                                小
                              </button>
                            </div>
                          </div>
                          <div className="projection-control-group ginmaku-scroll-controls">
                            <span>聖書箇所</span>
                            <div className="projection-control-buttons">
                              <button
                                aria-label="前の御言葉へ"
                                disabled={!audienceReady}
                                onClick={() => controlAudience("previous")}
                                type="button"
                              >
                                ↑
                              </button>
                              <button
                                aria-label="次の御言葉へ"
                                disabled={!audienceReady}
                                onClick={() => controlAudience("next")}
                                type="button"
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr>
                  <td className="ginmaku-search-toolbar" colSpan={3}>
                    <div className="scripture-range-fields">
                      <label>
                        <span>章</span>
                        <input
                          aria-label="章"
                          disabled={!selection.book || catalogLoading}
                          inputMode="numeric"
                          onChange={(event) =>
                            updateChapter(event.target.value)
                          }
                          pattern="[0-9]*"
                          size={3}
                          type="text"
                          value={selection.chapter}
                        />
                      </label>
                      <label>
                        <span>開始節</span>
                        <input
                          aria-label="開始節"
                          disabled={!selection.chapter || catalogLoading}
                          inputMode="numeric"
                          onChange={(event) =>
                            updateStartVerse(event.target.value)
                          }
                          pattern="[0-9]*"
                          size={4}
                          type="text"
                          value={selection.startVerse}
                        />
                      </label>
                      <span aria-hidden="true" className="range-separator">
                        〜
                      </span>
                      <label>
                        <span>終了節</span>
                        <input
                          aria-label="終了節（省略可）"
                          disabled={!selection.startVerse || catalogLoading}
                          inputMode="numeric"
                          onChange={(event) => {
                            setSelection({
                              ...selection,
                              endVerse: event.target.value,
                            });
                            setStatus({ kind: "idle" });
                          }}
                          pattern="[0-9]*"
                          size={4}
                          type="text"
                          value={selection.endVerse}
                        />
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
                              updateLanguage(value as ScriptureLanguage)
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
                        onClick={resetSearch}
                      >
                        Reset
                      </button>
                      <button
                        aria-label="空白と表示を切り替え"
                        className="search-action-blank"
                        disabled={!audienceReady}
                        onClick={() => controlAudience("toggle-blank")}
                        type="button"
                      >
                        空白⇔表示
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </fieldset>

          <div className="search-feedback" aria-live="polite">
            {catalogLoading ? (
              <p role="status">検索候補を読み込んでいます。</p>
            ) : null}
            {catalogError ? (
              <div
                className="notice notice-error"
                role="alert"
                tabIndex={-1}
                ref={feedbackRef}
              >
                <p>{catalogError}</p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void loadCatalog(selection)}
                >
                  再読み込み
                </button>
              </div>
            ) : null}
            {!catalogLoading && !catalogError && books.length === 0 ? (
              <p role="status">利用できる聖書データがありません。</p>
            ) : null}
            {status.kind === "error" ? (
              <div
                className="notice notice-error"
                role="alert"
                tabIndex={-1}
                ref={feedbackRef}
              >
                <p>{status.message}</p>
              </div>
            ) : null}
          </div>
        </form>
        <div id="ginmaku-add-bookmark-slot" />
      </div>
    </section>
  );
}
