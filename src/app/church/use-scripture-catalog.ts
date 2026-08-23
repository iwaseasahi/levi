"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  ScriptureCatalog,
  ScriptureCatalogBook,
  ScriptureLanguage,
} from "@/domain/scripture/search";
import { requestJson } from "./client-api";
import {
  contiguousEndVerses,
  initialScriptureSelection,
  scriptureCatalogUrl,
  type ScriptureSelection,
} from "./scripture-search-selection";

type CatalogState = {
  selection: ScriptureSelection;
  books: ScriptureCatalogBook[];
  chapters: number[];
  verses: number[];
  loading: boolean;
  error: string;
};

type CatalogAction =
  | { type: "request-started" }
  | { type: "request-succeeded"; catalog: ScriptureCatalog }
  | { type: "request-failed" }
  | { type: "request-cancelled" }
  | { type: "language-selected"; language: ScriptureLanguage }
  | { type: "book-selected"; book: string }
  | { type: "chapter-selected"; chapter: string }
  | { type: "start-verse-selected"; startVerse: string }
  | { type: "end-verse-selected"; endVerse: string }
  | { type: "reset" };

const initialState: CatalogState = {
  books: [],
  chapters: [],
  error: "",
  loading: true,
  selection: initialScriptureSelection,
  verses: [],
};

function catalogReducer(
  state: CatalogState,
  action: CatalogAction,
): CatalogState {
  switch (action.type) {
    case "request-started":
      return { ...state, error: "", loading: true };
    case "request-succeeded":
      return {
        ...state,
        books: action.catalog.books,
        chapters: action.catalog.chapters,
        error: "",
        loading: false,
        verses: action.catalog.verses,
      };
    case "request-failed":
      return {
        ...state,
        books: [],
        chapters: [],
        error:
          "検索候補を読み込めませんでした。しばらくしてから再度お試しください。",
        loading: false,
        verses: [],
      };
    case "request-cancelled":
      return { ...state, loading: false };
    case "language-selected":
      return {
        ...state,
        selection: { ...state.selection, language: action.language },
      };
    case "book-selected":
      return {
        ...state,
        chapters: [],
        selection: {
          ...state.selection,
          book: action.book,
          chapter: "",
          endVerse: "",
          startVerse: "",
        },
        verses: [],
      };
    case "chapter-selected":
      return {
        ...state,
        selection: {
          ...state.selection,
          chapter: action.chapter,
          endVerse: "",
          startVerse: "",
        },
        verses: [],
      };
    case "start-verse-selected": {
      const endVerse =
        state.selection.endVerse &&
        !contiguousEndVerses(state.verses, action.startVerse).includes(
          Number(state.selection.endVerse),
        )
          ? action.startVerse
          : state.selection.endVerse;
      return {
        ...state,
        selection: {
          ...state.selection,
          endVerse,
          startVerse: action.startVerse,
        },
      };
    }
    case "end-verse-selected":
      return {
        ...state,
        selection: { ...state.selection, endVerse: action.endVerse },
      };
    case "reset":
      return { ...initialState };
  }
}

export function useScriptureCatalog(fetcher: typeof fetch) {
  const fetcherRef = useRef(fetcher);
  const requestSequence = useRef(0);
  const [state, dispatch] = useReducer(catalogReducer, initialState);

  const loadCatalog = useCallback(async (selection: ScriptureSelection) => {
    const sequence = ++requestSequence.current;
    dispatch({ type: "request-started" });
    try {
      const catalog = await requestJson<ScriptureCatalog>(
        fetcherRef.current,
        scriptureCatalogUrl(selection),
        { cache: "no-store", headers: { Accept: "application/json" } },
        "catalog unavailable",
      );
      if (sequence !== requestSequence.current) return;
      dispatch({ catalog, type: "request-succeeded" });
    } catch {
      if (sequence !== requestSequence.current) return;
      dispatch({ type: "request-failed" });
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadCatalog(initialScriptureSelection));
  }, [loadCatalog]);

  const updateLanguage = useCallback(
    (language: ScriptureLanguage) => {
      const next = { ...state.selection, language };
      dispatch({ language, type: "language-selected" });
      void loadCatalog(next);
    },
    [loadCatalog, state.selection],
  );

  const updateBook = useCallback(
    (book: string) => {
      const next = {
        ...state.selection,
        book,
        chapter: "",
        endVerse: "",
        startVerse: "",
      };
      dispatch({ book, type: "book-selected" });
      if (book) void loadCatalog(next);
      else {
        requestSequence.current += 1;
        dispatch({ type: "request-cancelled" });
      }
    },
    [loadCatalog, state.selection],
  );

  const updateChapter = useCallback(
    (chapter: string) => {
      const next = {
        ...state.selection,
        chapter,
        endVerse: "",
        startVerse: "",
      };
      dispatch({ chapter, type: "chapter-selected" });
      if (chapter) void loadCatalog(next);
      else {
        requestSequence.current += 1;
        dispatch({ type: "request-cancelled" });
      }
    },
    [loadCatalog, state.selection],
  );

  const updateStartVerse = useCallback((startVerse: string) => {
    dispatch({ startVerse, type: "start-verse-selected" });
  }, []);

  const updateEndVerse = useCallback((endVerse: string) => {
    dispatch({ endVerse, type: "end-verse-selected" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    void loadCatalog(initialScriptureSelection);
  }, [loadCatalog]);

  return {
    ...state,
    loadCatalog,
    reset,
    updateBook,
    updateChapter,
    updateEndVerse,
    updateLanguage,
    updateStartVerse,
  };
}
