"use client";

import { useState, type FormEvent } from "react";
import { SavedContentPanel } from "./saved-content-panel";
import {
  normalizeScriptureSearch,
  scriptureFavoriteTitle,
} from "./scripture-search-selection";
import {
  ScriptureSearchFeedback,
  ScriptureSearchFields,
} from "./scripture-search-view";
import { useDirectAudienceController } from "./use-direct-audience-controller";
import { useScriptureCatalog } from "./use-scripture-catalog";

export function ScriptureSearch({
  fetcher = fetch,
  savedContentFetcher = fetcher,
}: {
  fetcher?: typeof fetch;
  savedContentFetcher?: typeof fetch;
}) {
  const catalog = useScriptureCatalog(fetcher);
  const audience = useDirectAudienceController();
  const [validationError, setValidationError] = useState("");
  const currentSearch = normalizeScriptureSearch(
    catalog.selection,
    catalog.chapters,
    catalog.verses,
  );

  function clearInteractionError() {
    setValidationError("");
    audience.clearError();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    audience.clearError();
    const missingRequiredMessage = !catalog.selection.book
      ? "書巻を選択してください。"
      : !catalog.selection.chapter
        ? "章を入力してください。"
        : !catalog.selection.startVerse
          ? "開始節を入力してください。"
          : null;
    if (missingRequiredMessage) {
      setValidationError(missingRequiredMessage);
      return;
    }
    if (!currentSearch) {
      setValidationError("検索条件を確認してください。");
      return;
    }
    setValidationError("");
    audience.open(currentSearch);
  }

  function resetSearch() {
    clearInteractionError();
    catalog.reset();
  }

  return (
    <section className="ginmaku-search-workspace" aria-label="聖句検索">
      <h1 className="sr-only">聖句検索</h1>
      <div id="bookmark_container" className="ginmaku-bookmark-container">
        <SavedContentPanel
          currentSearch={currentSearch}
          currentSearchTitle={scriptureFavoriteTitle(
            catalog.selection,
            currentSearch,
            catalog.books,
          )}
          fetcher={savedContentFetcher}
          onOpen={async (search) => audience.open(search)}
        />
      </div>

      <div id="index_container">
        <ScriptureSearchFields
          audienceReady={audience.ready}
          books={catalog.books}
          catalogError={catalog.error}
          loading={catalog.loading}
          onBookChange={(book) => {
            clearInteractionError();
            catalog.updateBook(book);
          }}
          onChapterChange={(chapter) => {
            clearInteractionError();
            catalog.updateChapter(chapter);
          }}
          onControl={audience.control}
          onEndVerseChange={(endVerse) => {
            clearInteractionError();
            catalog.updateEndVerse(endVerse);
          }}
          onLanguageChange={(language) => {
            clearInteractionError();
            catalog.updateLanguage(language);
          }}
          onReset={resetSearch}
          onStartVerseChange={(startVerse) => {
            clearInteractionError();
            catalog.updateStartVerse(startVerse);
          }}
          onSubmit={submit}
          selection={catalog.selection}
        >
          <ScriptureSearchFeedback
            books={catalog.books}
            catalogError={catalog.error}
            interactionError={validationError || audience.error}
            loading={catalog.loading}
            onRetry={() => void catalog.loadCatalog(catalog.selection)}
          />
        </ScriptureSearchFields>
      </div>
    </section>
  );
}
