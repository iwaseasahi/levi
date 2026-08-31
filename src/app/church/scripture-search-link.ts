import type { ScriptureBookmarkSearch } from "@/domain/saved-content";
import { parseScriptureSearch } from "@/domain/scripture/search";
import {
  initialScriptureSelection,
  type ScriptureSelection,
} from "./scripture-search-selection";

export function scriptureSearchLink(search: ScriptureBookmarkSearch) {
  const params = new URLSearchParams({
    book: search.book,
    chapter: String(search.chapter),
    startVerse: String(search.startVerse),
    language: search.language,
  });
  if (search.endVerse !== null) params.set("endVerse", String(search.endVerse));
  return `/scripture?${params}` as const;
}

export function scriptureSelectionFromQuery(
  query: Record<string, string | string[] | undefined>,
): ScriptureSelection {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) return initialScriptureSelection;
    if (value !== undefined) params.set(key, value);
  }
  const omittedEnd = !params.has("endVerse");
  if (omittedEnd) params.set("endVerse", params.get("startVerse") ?? "");
  try {
    const search = parseScriptureSearch(params);
    return {
      book: search.book,
      chapter: String(search.chapter),
      startVerse: String(search.startVerse),
      endVerse: omittedEnd ? "" : String(search.endVerse),
      language: search.language,
    };
  } catch {
    return initialScriptureSelection;
  }
}
