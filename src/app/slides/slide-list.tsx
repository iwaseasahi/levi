"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { requestJson } from "@/app/church/client-api";
import { useComponentLifetimeValue } from "@/app/church/use-component-lifetime-value";
import {
  parseSlideSearch,
  type SlideSearchResult,
} from "@/domain/slides/search";
import { SlideError, slideErrorMessage } from "./slide-error";

type Selection = {
  mode: "all" | "recent";
  q: string;
  cursors: Array<string | null>;
};
export function SlideList({
  fetcher: providedFetcher = fetch,
}: {
  fetcher?: typeof fetch;
}) {
  const fetcher = useComponentLifetimeValue(providedFetcher);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>({
    mode: "recent",
    q: "",
    cursors: [null],
  });
  const [loaded, setLoaded] = useState<{
    selection: Selection;
    result?: SlideSearchResult;
    error?: string;
  } | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({
      mode: selection.mode,
      q: selection.q,
    });
    const cursor = selection.cursors.at(-1);
    if (cursor) params.set("cursor", cursor);
    void requestJson<SlideSearchResult>(
      fetcher,
      `/api/church/slides?${params}`,
      { cache: "no-store" },
      "SLIDE_UNAVAILABLE",
    )
      .then((result) => {
        if (current) setLoaded({ selection, result });
      })
      .catch((cause: unknown) => {
        if (current) setLoaded({ selection, error: slideErrorMessage(cause) });
      });
    return () => {
      current = false;
    };
  }, [selection, fetcher]);
  const active = loaded?.selection === selection ? loaded : null;
  const result = active?.result;
  function choose(mode: "all" | "recent", q = "") {
    setValidation(null);
    setSelection({ mode, q, cursors: [null] });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      choose("all", parseSlideSearch({ q: query }).q);
    } catch {
      setValidation(
        "検索語は200文字以内で入力してください。NULや不正な文字は使えません。",
      );
    }
  }
  return (
    <>
      <div className="slide-actions">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            choose("recent");
          }}
        >
          最近の更新
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            choose("all");
          }}
        >
          すべて
        </button>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="slide-query">本文を検索</label>
        <textarea
          id="slide-query"
          rows={2}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-describedby="slide-query-help"
        />
        <p id="slide-query-help">
          200文字以内。空白・改行も検索に含みます。タイトル・著者は検索しません。
        </p>
        <button type="submit">検索</button>
      </form>
      {validation && <SlideError message={validation} />}
      {!active && <p role="status">読み込み中…</p>}
      {active?.error && (
        <>
          <SlideError message={active.error} />
          <button type="button" onClick={() => setSelection({ ...selection })}>
            再試行
          </button>
        </>
      )}
      <section aria-label="スライド一覧" aria-busy={!active}>
        <h2>
          {selection.mode === "recent"
            ? "最近の更新（最大10件）"
            : selection.q
              ? "検索結果"
              : "すべてのスライド"}
        </h2>
        {result && (
          <p role="status">
            {result.slides.length
              ? `${selection.cursors.length}ページ目 · ${result.slides.length}件`
              : selection.q
                ? "一致するスライドはありません。"
                : "スライドはまだありません。"}
          </p>
        )}
        <ul className="slide-list">
          {result?.slides.map((slide) => (
            <li key={slide.id}>
              <Link href={`/slides/${slide.id}`}>{slide.title}</Link>
              {slide.author && <span>{slide.author}</span>}
            </li>
          ))}
        </ul>
        <div className="slide-actions">
          <button
            type="button"
            disabled={!result || selection.cursors.length === 1}
            onClick={() =>
              setSelection({
                ...selection,
                cursors: selection.cursors.slice(0, -1),
              })
            }
          >
            前の20件
          </button>
          <button
            type="button"
            disabled={!result?.nextCursor}
            onClick={() =>
              setSelection({
                ...selection,
                cursors: [...selection.cursors, result?.nextCursor ?? null],
              })
            }
          >
            次の20件
          </button>
          <button
            type="button"
            onClick={() => choose(selection.mode, selection.q)}
          >
            一覧を更新
          </button>
        </div>
      </section>
    </>
  );
}
