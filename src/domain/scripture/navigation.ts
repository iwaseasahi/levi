import { z } from "zod";
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

const positiveSmallInt = z
  .string()
  .regex(/^[1-9]\d{0,4}$/)
  .transform(Number)
  .refine((value) => value <= 32767);
const nonNegativeSmallInt = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,4})$/)
  .transform(Number)
  .refine((value) => value <= 32767);
const navigationSchema = z
  .object({
    book: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{0,15}$/),
    chapter: positiveSmallInt,
    verse: nonNegativeSmallInt,
    direction: z.enum(["previous", "next"]),
    language: z.enum(["ja", "en", "both"]),
  })
  .strict();

export function parseScriptureNavigation(searchParams: URLSearchParams) {
  const allowed = new Set([
    "book",
    "chapter",
    "verse",
    "direction",
    "language",
  ]);
  if (
    [...searchParams.keys()].some((key) => !allowed.has(key)) ||
    [...allowed].some((key) => searchParams.getAll(key).length !== 1)
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
