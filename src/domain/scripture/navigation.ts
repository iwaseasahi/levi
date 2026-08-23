import { z } from "zod";
import {
  hasExactQueryMultiplicity,
  nonNegativeSmallIntSchema,
  positiveSmallIntSchema,
  scriptureBookCodeSchema,
  scriptureLanguages,
} from "./identifiers";
import {
  assembleScriptureSearchItems,
  type ScriptureLanguage,
  type ScriptureRow,
  ScriptureSearchError,
} from "./search";

export type ScriptureNavigation = {
  book: string;
  chapter: number;
  verse: number;
  direction: "previous" | "next";
  language: ScriptureLanguage;
};

export type ScriptureNavigationEdge = "book-start" | "book-end";

const navigationSchema = z
  .object({
    book: scriptureBookCodeSchema,
    chapter: positiveSmallIntSchema,
    verse: nonNegativeSmallIntSchema,
    direction: z.enum(["previous", "next"]),
    language: z.enum(scriptureLanguages),
  })
  .strict();

export function parseScriptureNavigation(searchParams: URLSearchParams) {
  if (
    !hasExactQueryMultiplicity(searchParams, {
      required: ["book", "chapter", "verse", "direction", "language"],
    })
  )
    throw new ScriptureSearchError("INVALID_SEARCH_INPUT");
  const result = navigationSchema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) throw new ScriptureSearchError("INVALID_SEARCH_INPUT");
  return result.data satisfies ScriptureNavigation;
}

export function assembleNavigatedItem(
  navigation: ScriptureNavigation,
  location: { book: string; chapter: number; verse: number },
  rows: ScriptureRow[],
) {
  if (rows.length === 0)
    throw new ScriptureSearchError("TRANSLATION_NOT_AVAILABLE");
  const search = {
    book: location.book,
    chapter: location.chapter,
    startVerse: location.verse,
    endVerse: location.verse,
    language: navigation.language,
  } as const;
  const [item] = assembleScriptureSearchItems(search, rows);
  if (!item) throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
  return item;
}
