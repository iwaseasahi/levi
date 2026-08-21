"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type {
  ScriptureCatalog,
  ScriptureCatalogBook,
  ScriptureLanguage,
  ScriptureSearchItem,
} from "@/domain/scripture/search";

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

function referenceFor(item: ScriptureSearchItem) {
  const text = item.texts.japanese ?? item.texts.english;
  return `${text?.bookName ?? item.location.book} ${item.location.chapter}:${item.location.verse}`;
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

export function ScriptureSearch({
  fetcher = fetch,
}: {
  fetcher?: typeof fetch;
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [books, setBooks] = useState<ScriptureCatalogBook[]>([]);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verses, setVerses] = useState<number[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const requestSequence = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

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
    if (status.kind === "success") resultsRef.current?.focus();
    if (status.kind === "error" || status.kind === "empty")
      feedbackRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (catalogError) feedbackRef.current?.focus();
  }, [catalogError]);

  function updateLanguage(language: ScriptureLanguage) {
    const next = { ...initialSelection, language };
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selection.book ||
      !selection.chapter ||
      !selection.startVerse ||
      !selection.endVerse
    ) {
      setStatus({
        kind: "error",
        message: "書巻、章、開始節、終了節をすべて選択してください。",
      });
      return;
    }

    setStatus({ kind: "loading", message: "御言葉を検索しています。" });
    try {
      const query = new URLSearchParams({
        book: selection.book,
        chapter: selection.chapter,
        startVerse: selection.startVerse,
        endVerse: selection.endVerse,
        language: selection.language,
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
    } catch {
      setStatus({ kind: "error", message: errorMessage() });
    }
  }

  const pending = catalogLoading || status.kind === "loading";
  const validEndVerses = contiguousEndVerses(verses, selection.startVerse);

  return (
    <section
      className="scripture-workspace"
      aria-labelledby="scripture-search-title"
    >
      <form className="scripture-search-form" onSubmit={submit}>
        <div className="section-heading">
          <p className="eyebrow">Scripture search</p>
          <h2 id="scripture-search-title">御言葉を検索</h2>
          <p>書巻と範囲を選び、会衆へ投影する内容を確認します。</p>
        </div>

        <fieldset disabled={pending || Boolean(catalogError)}>
          <legend className="sr-only">御言葉の検索条件</legend>
          <label htmlFor="scripture-language">表示言語</label>
          <select
            id="scripture-language"
            value={selection.language}
            onChange={(event) =>
              updateLanguage(event.target.value as ScriptureLanguage)
            }
          >
            <option value="ja">日本語（新改訳聖書第3版）</option>
            <option value="en">英語（NKJV）</option>
            <option value="both">日本語と英語</option>
          </select>

          <label htmlFor="scripture-book">書巻</label>
          <select
            id="scripture-book"
            value={selection.book}
            onChange={(event) => updateBook(event.target.value)}
          >
            <option value="">書巻を選択</option>
            {books.map((book) => (
              <option key={book.code} value={book.code}>
                {book.name}
              </option>
            ))}
          </select>

          <label htmlFor="scripture-chapter">章</label>
          <select
            id="scripture-chapter"
            disabled={!selection.book || catalogLoading}
            value={selection.chapter}
            onChange={(event) => updateChapter(event.target.value)}
          >
            <option value="">章を選択</option>
            {chapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}章
              </option>
            ))}
          </select>

          <div className="verse-range">
            <div>
              <label htmlFor="scripture-start-verse">開始節</label>
              <select
                id="scripture-start-verse"
                disabled={!selection.chapter || catalogLoading}
                value={selection.startVerse}
                onChange={(event) => updateStartVerse(event.target.value)}
              >
                <option value="">開始節を選択</option>
                {verses.map((verse) => (
                  <option key={verse} value={verse}>
                    {verse}節
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scripture-end-verse">終了節</label>
              <select
                id="scripture-end-verse"
                disabled={!selection.startVerse || catalogLoading}
                value={selection.endVerse}
                onChange={(event) => {
                  setSelection({ ...selection, endVerse: event.target.value });
                  setStatus({ kind: "idle" });
                }}
              >
                <option value="">終了節を選択</option>
                {validEndVerses.map((verse) => (
                  <option key={verse} value={verse}>
                    {verse}節
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <button
          className="primary-button"
          disabled={pending || Boolean(catalogError)}
          type="submit"
        >
          {status.kind === "loading" ? "検索中…" : "御言葉を検索"}
        </button>

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

      <div className="scripture-results" aria-busy={status.kind === "loading"}>
        {status.kind === "success" ? (
          <>
            <div className="results-heading">
              <div>
                <p className="eyebrow">Search result</p>
                <h2 ref={resultsRef} tabIndex={-1}>
                  検索結果
                </h2>
              </div>
              <Link
                className="projection-link"
                href={`/church/projection?${new URLSearchParams({
                  book: status.result.search.book,
                  chapter: String(status.result.search.chapter),
                  startVerse: String(status.result.search.startVerse),
                  endVerse: String(status.result.search.endVerse),
                  language: status.result.search.language,
                })}`}
              >
                投影を開始
              </Link>
            </div>
            <ol className="verse-results">
              {status.result.items.map((item) => (
                <li
                  key={`${item.location.book}-${item.location.chapter}-${item.location.verse}`}
                >
                  <h3>{referenceFor(item)}</h3>
                  {item.texts.japanese ? (
                    <div className="translation-text">
                      <p className="translation-name">
                        新改訳聖書第3版（JSS3）
                      </p>
                      <p>{item.texts.japanese.text}</p>
                    </div>
                  ) : null}
                  {item.texts.english ? (
                    <div className="translation-text" lang="en">
                      <p className="translation-name">
                        New King James Version (NKJV)
                      </p>
                      <p>{item.texts.english.text}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="results-placeholder">
            <p className="eyebrow">Search result</p>
            <h2>検索結果</h2>
            <p>検索すると、選択した御言葉がここに表示されます。</p>
          </div>
        )}
      </div>
    </section>
  );
}
