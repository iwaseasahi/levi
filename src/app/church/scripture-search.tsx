"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  ScriptureCatalog,
  ScriptureCatalogBook,
  ScriptureLanguage,
  ScriptureSearchItem,
} from "@/domain/scripture/search";
import { SavedContentPanel } from "./saved-content-panel";

type SearchResponse = {
  items: ScriptureSearchItem[];
  search: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    language: ScriptureLanguage;
  };
};

type Status =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "success"; result: SearchResponse };

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

function errorMessage(code?: string) {
  switch (code) {
    case "INVALID_SEARCH_INPUT":
    case "INVALID_VERSE_RANGE":
      return "検索条件を確認してください。";
    case "VERSE_RANGE_NOT_FOUND":
    case "CHAPTER_NOT_FOUND":
    case "BOOK_NOT_FOUND":
      return "指定した聖書箇所は見つかりませんでした。";
    case "TRANSLATION_NOT_AVAILABLE":
      return "選択した翻訳ではこの箇所を表示できません。";
    default:
      return "御言葉を読み込めませんでした。しばらくしてから再度お試しください。";
  }
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
): SearchResponse["search"] | null {
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

function projectionUrl(search: SearchResponse["search"]) {
  return `/church/projection?${new URLSearchParams({
    book: search.book,
    chapter: String(search.chapter),
    endVerse: String(search.endVerse),
    language: search.language,
    startVerse: String(search.startVerse),
  })}` as Route;
}

export function ScriptureSearch({
  fetcher = fetch,
  savedContentFetcher = fetcher,
}: {
  fetcher?: typeof fetch;
  savedContentFetcher?: typeof fetch;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState(initialSelection);
  const [books, setBooks] = useState<ScriptureCatalogBook[]>([]);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verses, setVerses] = useState<number[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const requestSequence = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  async function loadCatalog(next: Selection) {
    const sequence = ++requestSequence.current;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const response = await fetcher(catalogUrl(next), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("catalog unavailable");
      const catalog = (await response.json()) as ScriptureCatalog;
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
    if (status.kind === "error" || status.kind === "empty")
      feedbackRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (catalogError) feedbackRef.current?.focus();
  }, [catalogError]);

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

  async function performSearch(next: Selection) {
    setStatus({ kind: "loading", message: "御言葉を検索しています。" });
    try {
      const query = new URLSearchParams({
        book: next.book,
        chapter: next.chapter,
        startVerse: next.startVerse,
        endVerse: next.endVerse,
        language: next.language,
      });
      const response = await fetcher(`/api/scripture/search?${query}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as
        SearchResponse | { error?: { code?: string } };
      if (!response.ok) {
        setStatus({
          kind: "error",
          message: errorMessage(
            "error" in payload ? payload.error?.code : undefined,
          ),
        });
        return;
      }
      const result = payload as SearchResponse;
      if (result.items.length === 0) {
        setStatus({ kind: "empty", message: "該当する御言葉はありません。" });
        return;
      }
      setStatus({ kind: "success", result });
      router.push(projectionUrl(result.search));
    } catch {
      setStatus({ kind: "error", message: errorMessage() });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection.book || !selection.chapter || !selection.startVerse) {
      setStatus({
        kind: "error",
        message: "書巻、章、開始節をすべて入力してください。",
      });
      return;
    }
    const search = normalizedSearch(selection, chapters, verses);
    if (!search) {
      setStatus({ kind: "error", message: "検索条件を確認してください。" });
      return;
    }
    await performSearch({
      book: search.book,
      chapter: String(search.chapter),
      endVerse: String(search.endVerse),
      language: search.language,
      startVerse: String(search.startVerse),
    });
  }

  function resetSearch() {
    setSelection(initialSelection);
    setStatus({ kind: "idle" });
    setChapters([]);
    setVerses([]);
    void loadCatalog(initialSelection);
  }

  async function reopenBookmark(search: SearchResponse["search"]) {
    router.push(projectionUrl(search));
  }

  const pending = catalogLoading || status.kind === "loading";
  const currentSearch = normalizedSearch(selection, chapters, verses);

  return (
    <section className="ginmaku-search-workspace" aria-label="聖句検索">
      <h1 className="sr-only">聖句検索</h1>
      <div id="bookmark_container" className="ginmaku-bookmark-container">
        <SavedContentPanel
          currentSearch={currentSearch}
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
                          <label>
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
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <label>
                      <input
                        aria-label="章"
                        disabled={!selection.book || catalogLoading}
                        inputMode="numeric"
                        onChange={(event) => updateChapter(event.target.value)}
                        pattern="[0-9]*"
                        size={3}
                        type="text"
                        value={selection.chapter}
                      />
                      章(chapter)
                    </label>{" "}
                    <label>
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
                      節(verse)
                    </label>{" "}
                    <span aria-hidden="true">〜</span>{" "}
                    <label>
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
                      節(verse)
                    </label>
                    <br />
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
                        {label}
                      </label>
                    ))}
                    <br />
                    <button
                      disabled={pending || Boolean(catalogError)}
                      type="submit"
                    >
                      {status.kind === "loading" ? "検索中…" : "Open"}
                    </button>{" "}
                    <button type="button" onClick={resetSearch}>
                      Reset
                    </button>
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
            {status.kind === "error" || status.kind === "empty" ? (
              <div
                className={`notice ${status.kind === "error" ? "notice-error" : ""}`}
                role={status.kind === "error" ? "alert" : "status"}
                tabIndex={-1}
                ref={feedbackRef}
              >
                <p>{status.message}</p>
              </div>
            ) : null}
            {status.kind === "loading" ? (
              <p role="status">{status.message}</p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
