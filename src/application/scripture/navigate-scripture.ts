import {
  assembleNavigatedItem,
  type ScriptureNavigation,
  type ScriptureNavigationEdge,
} from "@/domain/scripture/navigation";
import {
  requiredTranslations,
  type ScriptureRow,
  ScriptureSearchError,
} from "@/domain/scripture/search";

export type ScriptureNavigationSnapshot = {
  approvedTranslations: string[];
  bookExists: boolean;
  currentExists: boolean;
  location: { book: string; chapter: number; verse: number } | null;
  rows: ScriptureRow[];
};

export interface ScriptureNavigationRepository {
  readAdjacent(
    navigation: ScriptureNavigation,
  ): Promise<ScriptureNavigationSnapshot>;
}

export async function navigateScripture(
  repository: ScriptureNavigationRepository,
  navigation: ScriptureNavigation,
) {
  const snapshot = await repository.readAdjacent(navigation);
  if (!snapshot.bookExists) throw new ScriptureSearchError("BOOK_NOT_FOUND");
  const required = requiredTranslations(navigation.language);
  if (
    required.some(
      (translation) => !snapshot.approvedTranslations.includes(translation),
    )
  )
    throw new ScriptureSearchError("TRANSLATION_NOT_AVAILABLE");
  if (!snapshot.currentExists)
    throw new ScriptureSearchError("VERSE_RANGE_NOT_FOUND");
  if (!snapshot.location) {
    const edge: ScriptureNavigationEdge =
      navigation.direction === "next" ? "book-end" : "book-start";
    return { crossedBook: false, crossedChapter: false, edge, item: null };
  }
  return {
    crossedBook: snapshot.location.book !== navigation.book,
    crossedChapter:
      snapshot.location.book !== navigation.book ||
      snapshot.location.chapter !== navigation.chapter,
    edge: null,
    item: assembleNavigatedItem(navigation, snapshot.location, snapshot.rows),
  };
}
