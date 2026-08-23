import type {
  ScriptureCatalogBook,
  ScriptureLanguage,
  ScriptureSearch,
} from "@/domain/scripture/search";

export type ScriptureSelection = {
  book: string;
  chapter: string;
  startVerse: string;
  endVerse: string;
  language: ScriptureLanguage;
};

export const initialScriptureSelection: ScriptureSelection = {
  book: "",
  chapter: "",
  startVerse: "",
  endVerse: "",
  language: "both",
};

export function scriptureCatalogUrl(
  selection: Pick<ScriptureSelection, "book" | "chapter" | "language">,
) {
  const query = new URLSearchParams({ language: selection.language });
  if (selection.book) query.set("book", selection.book);
  if (selection.chapter) query.set("chapter", selection.chapter);
  return `/api/scripture/catalog?${query}`;
}

export function contiguousEndVerses(verses: number[], startVerse: string) {
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

export function normalizeScriptureSearch(
  selection: ScriptureSelection,
  chapters: number[],
  verses: number[],
): ScriptureSearch | null {
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

export function scriptureFavoriteTitle(
  selection: ScriptureSelection,
  search: ScriptureSearch | null,
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
