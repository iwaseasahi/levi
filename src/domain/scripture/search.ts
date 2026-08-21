import { z } from "zod";

export const scriptureLanguages = ["ja", "en", "both"] as const;
export type ScriptureLanguage = (typeof scriptureLanguages)[number];

export type ScriptureSearch = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  language: ScriptureLanguage;
};

export type ScriptureRow = {
  bookCode: string;
  bookName: string;
  chapter: number;
  verse: number;
  translation: "JSS3" | "NKJV";
  text: string;
};

export type ScriptureSearchItem = {
  location: { book: string; chapter: number; verse: number };
  texts: {
    japanese?: { bookName: string; translation: "JSS3"; text: string };
    english?: { bookName: string; translation: "NKJV"; text: string };
  };
};

export type ScriptureCatalogQuery = {
  book?: string;
  chapter?: number;
  language: ScriptureLanguage;
};

export type ScriptureCatalogBook = {
  code: string;
  englishName?: string;
  japaneseName?: string;
  name: string;
};

export type ScriptureCatalog = {
  books: ScriptureCatalogBook[];
  chapters: number[];
  verses: number[];
};

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
const searchSchema = z
  .object({
    book: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{0,15}$/),
    chapter: positiveSmallInt,
    startVerse: nonNegativeSmallInt,
    endVerse: nonNegativeSmallInt,
    language: z.enum(scriptureLanguages),
  })
  .strict()
  .refine(({ startVerse, endVerse }) => endVerse - startVerse < 500, {
    path: ["endVerse"],
  });

const catalogSchema = z
  .object({
    book: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9_-]{0,15}$/)
      .optional(),
    chapter: positiveSmallInt.optional(),
    language: z.enum(scriptureLanguages),
  })
  .strict()
  .refine(({ book, chapter }) => chapter === undefined || book !== undefined, {
    path: ["chapter"],
  });

export class ScriptureSearchError extends Error {
  constructor(
    public readonly code:
      | "BOOK_NOT_FOUND"
      | "CATALOG_INTEGRITY_ERROR"
      | "CHAPTER_NOT_FOUND"
      | "INVALID_VERSE_RANGE"
      | "INVALID_SEARCH_INPUT"
      | "TRANSLATION_NOT_AVAILABLE"
      | "VERSE_RANGE_NOT_FOUND",
  ) {
    super(code);
    this.name = "ScriptureSearchError";
  }
}

export function parseScriptureSearch(searchParams: URLSearchParams) {
  const allowed = new Set([
    "book",
    "chapter",
    "startVerse",
    "endVerse",
    "language",
  ]);
  if (
    [...searchParams.keys()].some((key) => !allowed.has(key)) ||
    [...allowed].some((key) => searchParams.getAll(key).length !== 1)
  )
    throw new ScriptureSearchError("INVALID_SEARCH_INPUT");

  const result = searchSchema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) throw new ScriptureSearchError("INVALID_SEARCH_INPUT");
  if (result.data.endVerse < result.data.startVerse)
    throw new ScriptureSearchError("INVALID_VERSE_RANGE");
  return result.data satisfies ScriptureSearch;
}

export function parseScriptureCatalogQuery(searchParams: URLSearchParams) {
  const allowed = new Set(["book", "chapter", "language"]);
  if (
    [...searchParams.keys()].some((key) => !allowed.has(key)) ||
    searchParams.getAll("language").length !== 1 ||
    searchParams.getAll("book").length > 1 ||
    searchParams.getAll("chapter").length > 1
  )
    throw new ScriptureSearchError("INVALID_SEARCH_INPUT");

  const result = catalogSchema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) throw new ScriptureSearchError("INVALID_SEARCH_INPUT");
  return {
    language: result.data.language,
    ...(result.data.book === undefined ? {} : { book: result.data.book }),
    ...(result.data.chapter === undefined
      ? {}
      : { chapter: result.data.chapter }),
  } satisfies ScriptureCatalogQuery;
}

export function requiredTranslations(
  language: ScriptureLanguage,
): readonly ScriptureRow["translation"][] {
  return language === "ja"
    ? ["JSS3"]
    : language === "en"
      ? ["NKJV"]
      : ["JSS3", "NKJV"];
}

export function assembleScriptureSearchItems(
  search: ScriptureSearch,
  rows: ScriptureRow[],
): ScriptureSearchItem[] {
  const translations = requiredTranslations(search.language);
  const expectedVerses = Array.from(
    { length: search.endVerse - search.startVerse + 1 },
    (_, index) => search.startVerse + index,
  );
  const byVerse = new Map<number, Map<string, ScriptureRow>>();

  for (const row of rows) {
    if (
      row.bookCode !== search.book ||
      row.chapter !== search.chapter ||
      row.verse < search.startVerse ||
      row.verse > search.endVerse ||
      !translations.includes(row.translation)
    )
      throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
    const translationsAtVerse = byVerse.get(row.verse) ?? new Map();
    if (translationsAtVerse.has(row.translation))
      throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
    translationsAtVerse.set(row.translation, row);
    byVerse.set(row.verse, translationsAtVerse);
  }

  if (expectedVerses.some((verse) => !byVerse.has(verse)))
    throw new ScriptureSearchError("VERSE_RANGE_NOT_FOUND");
  if (
    expectedVerses.some((verse) =>
      translations.some((translation) => !byVerse.get(verse)!.has(translation)),
    )
  )
    throw new ScriptureSearchError("TRANSLATION_NOT_AVAILABLE");

  return expectedVerses.map((verse) => {
    const found = byVerse.get(verse)!;
    const japanese = found.get("JSS3");
    const english = found.get("NKJV");
    return {
      location: { book: search.book, chapter: search.chapter, verse },
      texts: {
        ...(japanese
          ? {
              japanese: {
                bookName: japanese.bookName,
                translation: "JSS3" as const,
                text: japanese.text,
              },
            }
          : {}),
        ...(english
          ? {
              english: {
                bookName: english.bookName,
                translation: "NKJV" as const,
                text: english.text,
              },
            }
          : {}),
      },
    };
  });
}
