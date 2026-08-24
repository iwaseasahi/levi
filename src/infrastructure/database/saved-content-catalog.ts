import type { Prisma } from "@/generated/prisma/client";
import { SavedContentError } from "@/domain/saved-content";
import {
  requiredTranslations,
  type ScriptureLanguage,
} from "@/domain/scripture/search";

type BookmarkCatalogInput = {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse: number | null;
  language: ScriptureLanguage;
};

export async function resolveBookmarkCatalog(
  transaction: Prisma.TransactionClient,
  input: BookmarkCatalogInput,
) {
  const book = await transaction.bibleBook.findUnique({
    where: { canonicalCode: input.book },
  });
  const codes = [...requiredTranslations(input.language)];
  const translations = await transaction.bibleTranslation.findMany({
    where: { code: { in: codes } },
  });
  if (!book || translations.length !== codes.length)
    throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");

  const effectiveEndVerse = input.endVerse ?? input.startVerse;
  const expectedCount = effectiveEndVerse - input.startVerse + 1;
  for (const translation of translations) {
    const count = await transaction.bibleVerse.count({
      where: {
        translationId: translation.id,
        bookId: book.id,
        chapterNumber: input.chapter,
        verseNumber: { gte: input.startVerse, lte: effectiveEndVerse },
      },
    });
    if (count !== expectedCount)
      throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
  }

  const byCode = new Map(translations.map((item) => [item.code, item.id]));
  const primaryCode = input.language === "en" ? "NKJV" : "JSS3";
  const secondaryCode = input.language === "both" ? "NKJV" : null;
  const primaryTranslationId = byCode.get(primaryCode);
  const secondaryTranslationId = secondaryCode
    ? byCode.get(secondaryCode)
    : undefined;
  if (!primaryTranslationId || (secondaryCode && !secondaryTranslationId))
    throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");

  return {
    bookId: book.id,
    primaryTranslationId,
    secondaryTranslationId,
  };
}
