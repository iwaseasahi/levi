import {
  assembleScriptureSearchItems,
  requiredTranslations,
  type ScriptureRow,
  type ScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";

export type ScriptureCatalogSnapshot = {
  approvedTranslations: string[];
  bookExists: boolean;
  chapterExists: boolean;
  chapterTranslations: string[];
  rows: ScriptureRow[];
};

export interface ScriptureSearchRepository {
  readRange(search: ScriptureSearch): Promise<ScriptureCatalogSnapshot>;
}

export async function searchScripture(
  repository: ScriptureSearchRepository,
  search: ScriptureSearch,
) {
  const snapshot = await repository.readRange(search);
  if (!snapshot.bookExists) throw new ScriptureSearchError("BOOK_NOT_FOUND");
  const required = requiredTranslations(search.language);
  if (
    required.some(
      (translation) => !snapshot.approvedTranslations.includes(translation),
    )
  )
    throw new ScriptureSearchError("TRANSLATION_NOT_AVAILABLE");
  if (!snapshot.chapterExists)
    throw new ScriptureSearchError("CHAPTER_NOT_FOUND");
  if (
    required.some(
      (translation) => !snapshot.chapterTranslations.includes(translation),
    )
  )
    throw new ScriptureSearchError("TRANSLATION_NOT_AVAILABLE");
  return {
    items: assembleScriptureSearchItems(search, snapshot.rows),
    search,
  };
}
