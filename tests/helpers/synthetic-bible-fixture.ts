import type {
  BibleBook,
  BibleTranslation,
  PrismaClient,
} from "@/generated/prisma/client";

type SyntheticTranslation = {
  code: string;
  displayOrder: number;
  languageTag: string;
  name?: string;
};

type SyntheticVerse = {
  chapterNumber: number;
  texts: Record<string, string>;
  verseNumber: number;
};

type SyntheticBook = {
  canonicalCode: string;
  canonicalOrder: number;
  names: Record<string, { name: string; shortName?: string }>;
  testament: "NEW" | "OLD";
  verses?: SyntheticVerse[];
};

export type SyntheticBibleFixtureSpec = {
  books: SyntheticBook[];
  sourceReference: string;
  translations: SyntheticTranslation[];
  upsertTranslations?: boolean;
};

export type SyntheticBibleCleanup = {
  bookCodes: string[];
  deleteTranslationCodes?: string[];
  resetTranslationCodes?: string[];
};

export async function clearSyntheticBibleFixture(
  client: PrismaClient,
  cleanup: SyntheticBibleCleanup,
) {
  if (cleanup.bookCodes.length > 0) {
    const books = { canonicalCode: { in: cleanup.bookCodes } };
    await client.bibleVerse.deleteMany({ where: { book: books } });
    await client.bibleBookName.deleteMany({ where: { book: books } });
    await client.bibleBook.deleteMany({
      where: { canonicalCode: { in: cleanup.bookCodes } },
    });
  }
  if (cleanup.deleteTranslationCodes?.length) {
    await client.bibleTranslation.deleteMany({
      where: { code: { in: cleanup.deleteTranslationCodes } },
    });
  }
  if (cleanup.resetTranslationCodes?.length) {
    await client.bibleTranslation.updateMany({
      data: {
        rightsNotice: null,
        rightsStatus: "PENDING",
        sourceReference: null,
      },
      where: { code: { in: cleanup.resetTranslationCodes } },
    });
  }
}

export async function createSyntheticBibleFixture(
  client: PrismaClient,
  spec: SyntheticBibleFixtureSpec,
) {
  const translations = new Map<string, BibleTranslation>();
  for (const translation of spec.translations) {
    const data = {
      ...translation,
      name: translation.name ?? `Synthetic ${translation.code}`,
      rightsNotice: "not scripture; test use only",
      rightsStatus: "APPROVED" as const,
      sourceReference: spec.sourceReference,
    };
    const created = spec.upsertTranslations
      ? await client.bibleTranslation.upsert({
          create: data,
          update: data,
          where: { code: translation.code },
        })
      : await client.bibleTranslation.create({ data });
    translations.set(created.code, created);
  }

  const books = new Map<string, BibleBook>();
  for (const book of spec.books) {
    const created = await client.bibleBook.create({
      data: {
        canonicalCode: book.canonicalCode,
        canonicalOrder: book.canonicalOrder,
        testament: book.testament,
      },
    });
    books.set(created.canonicalCode, created);
    await client.bibleBookName.createMany({
      data: Object.entries(book.names).map(
        ([translationCode, { name, shortName }]) => ({
          bookId: created.id,
          name,
          ...(shortName ? { shortName } : {}),
          translationId: translations.get(translationCode)!.id,
        }),
      ),
    });
    await client.bibleVerse.createMany({
      data: (book.verses ?? []).flatMap((verse) =>
        Object.entries(verse.texts).map(([translationCode, text]) => ({
          bookId: created.id,
          chapterNumber: verse.chapterNumber,
          text,
          translationId: translations.get(translationCode)!.id,
          verseNumber: verse.verseNumber,
        })),
      ),
    });
  }

  return { books, translations };
}
