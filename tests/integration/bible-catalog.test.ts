import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/client";

async function clearSyntheticCatalog() {
  await prisma.bibleVerse.deleteMany({
    where: { translation: { code: { startsWith: "TEST_" } } },
  });
  await prisma.bibleBookName.deleteMany({
    where: { translation: { code: { startsWith: "TEST_" } } },
  });
  await prisma.bibleTranslation.deleteMany({
    where: { code: { startsWith: "TEST_" } },
  });
  await prisma.bibleBook.deleteMany({
    where: { canonicalCode: { startsWith: "TEST_" } },
  });
}

async function createCatalogFixture() {
  const token = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const translation = await prisma.bibleTranslation.create({
    data: {
      code: `TEST_${token}`,
      name: `Synthetic translation ${token}`,
      languageTag: "en",
      displayOrder: 1000 + Number.parseInt(token.slice(0, 3), 16),
      rightsStatus: "APPROVED",
      sourceReference: "synthetic integration fixture",
      rightsNotice: "not scripture; test use only",
    },
  });
  const book = await prisma.bibleBook.create({
    data: {
      canonicalCode: `TEST_${token}`,
      canonicalOrder: 1000 + Number.parseInt(token.slice(3, 6), 16),
      testament: "NEW",
    },
  });
  await prisma.bibleBookName.create({
    data: {
      translationId: translation.id,
      bookId: book.id,
      name: `Synthetic book ${token}`,
      shortName: `S${token.slice(0, 4)}`,
    },
  });
  return { book, token, translation };
}

beforeEach(clearSyntheticCatalog);
afterEach(clearSyntheticCatalog);
afterAll(async () => {
  await clearSyntheticCatalog();
  await prisma.$disconnect();
});

describe("shared Bible catalog constraints", () => {
  it("stores one canonical location without depending on its generated ID", async () => {
    const { book, translation } = await createCatalogFixture();
    await prisma.bibleVerse.create({
      data: {
        translationId: translation.id,
        bookId: book.id,
        chapterNumber: 1,
        verseNumber: 1,
        text: "synthetic integration text",
      },
    });

    await expect(
      prisma.bibleVerse.findUnique({
        where: {
          translationId_bookId_chapterNumber_verseNumber: {
            translationId: translation.id,
            bookId: book.id,
            chapterNumber: 1,
            verseNumber: 1,
          },
        },
      }),
    ).resolves.toMatchObject({ text: "synthetic integration text" });
  });

  it("requires valid stable translation metadata and approved rights evidence", async () => {
    await expect(
      prisma.bibleTranslation.create({
        data: {
          code: "invalid code",
          name: " ",
          languageTag: "EN_us",
          displayOrder: 0,
          rightsStatus: "APPROVED",
        },
      }),
    ).rejects.toThrow();

    const { translation } = await createCatalogFixture();
    await expect(
      prisma.bibleTranslation.create({
        data: {
          code: translation.code,
          name: "Duplicate synthetic translation",
          languageTag: "en",
          displayOrder: translation.displayOrder + 1,
          rightsStatus: "PENDING",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces canonical book and translation-specific name uniqueness", async () => {
    const { book, token, translation } = await createCatalogFixture();

    await expect(
      prisma.bibleBook.create({
        data: {
          canonicalCode: book.canonicalCode,
          canonicalOrder: book.canonicalOrder + 1,
          testament: "OLD",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.bibleBookName.create({
        data: {
          translationId: translation.id,
          bookId: book.id,
          name: `Another name ${token}`,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.bibleBookName.update({
        where: {
          translationId_bookId: {
            translationId: translation.id,
            bookId: book.id,
          },
        },
        data: { shortName: " " },
      }),
    ).rejects.toThrow();
  });

  it("requires positive unique verse locations but deliberately permits empty text", async () => {
    const { book, translation } = await createCatalogFixture();
    const location = {
      translationId: translation.id,
      bookId: book.id,
      chapterNumber: 1,
      verseNumber: 1,
      text: "",
    };
    await prisma.bibleVerse.create({ data: location });

    await expect(
      prisma.bibleVerse.create({ data: location }),
    ).rejects.toThrow();
    await expect(
      prisma.bibleVerse.create({
        data: { ...location, chapterNumber: 0, verseNumber: 2 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.bibleVerse.create({
        data: { ...location, bookId: randomUUID(), verseNumber: 2 },
      }),
    ).rejects.toThrow();
  });

  it("restricts deletion of shared masters while dependent rows exist", async () => {
    const { book, translation } = await createCatalogFixture();
    await prisma.bibleVerse.create({
      data: {
        translationId: translation.id,
        bookId: book.id,
        chapterNumber: 1,
        verseNumber: 1,
        text: "synthetic integration text",
      },
    });

    await expect(
      prisma.bibleTranslation.delete({ where: { id: translation.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.bibleBook.delete({ where: { id: book.id } }),
    ).rejects.toThrow();
  });

  it("installs every named Bible constraint and navigation index", async () => {
    const constraints = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE connamespace = current_schema()::regnamespace
    `;
    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = current_schema()
    `;
    const constraintNames = constraints.map(({ name }) => name);
    const indexNames = indexes.map(({ name }) => name);

    expect(constraintNames).toEqual(
      expect.arrayContaining([
        "bible_translations_code_ck",
        "bible_translations_rights_ck",
        "bible_books_canonical_order_ck",
        "bible_book_names_name_nonblank_ck",
        "bible_verses_numbers_ck",
        "bible_verses_translation_fk",
        "bible_verses_book_fk",
      ]),
    );
    expect(constraintNames).not.toContain("bible_verses_text_nonblank_ck");
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "bible_translations_code_uk",
        "bible_books_canonical_order_uk",
        "bible_book_names_translation_name_uk",
        "bible_verses_location_uk",
        "bible_verses_navigation_idx",
      ]),
    );
  });
});
