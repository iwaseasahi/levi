import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { searchScripture } from "@/application/scripture/search-scripture";
import { readScriptureCatalog } from "@/application/scripture/read-scripture-catalog";
import { navigateScripture } from "@/application/scripture/navigate-scripture";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { prisma } from "@/infrastructure/database/client";
import { scriptureSearchRepository } from "@/infrastructure/database/scripture-search-repository";
import { scriptureCatalogRepository } from "@/infrastructure/database/scripture-catalog-repository";
import { scriptureNavigationRepository } from "@/infrastructure/database/scripture-navigation-repository";
import {
  clearSyntheticBibleFixture,
  createSyntheticBibleFixture,
} from "../helpers/synthetic-bible-fixture";

const baseSearch: ScriptureSearch = {
  book: "JHN",
  chapter: 3,
  startVerse: 16,
  endVerse: 18,
  language: "both",
};

const cleanup = {
  bookCodes: ["JHN"],
  resetTranslationCodes: ["JSS3", "NKJV"],
};

const clearFixture = () => clearSyntheticBibleFixture(prisma, cleanup);

async function createFixture() {
  const fixture = await createSyntheticBibleFixture(prisma, {
    books: [
      {
        canonicalCode: "JHN",
        canonicalOrder: 43,
        names: {
          JSS3: { name: "架空ヨハネ" },
          NKJV: { name: "Synthetic John" },
        },
        testament: "NEW",
        verses: [
          ...[15, 16, 17, 18, 19].map((verseNumber) => ({
            chapterNumber: 3,
            texts: {
              JSS3: `架空の日本語 3:${verseNumber}`,
              NKJV: `Synthetic English 3:${verseNumber}`,
            },
            verseNumber,
          })),
          {
            chapterNumber: 4,
            texts: {
              JSS3: "架空の日本語 4:1",
              NKJV: "Synthetic English 4:1",
            },
            verseNumber: 1,
          },
          {
            chapterNumber: 4,
            texts: {
              JSS3: "架空の日本語 4:3",
              NKJV: "Synthetic English 4:3",
            },
            verseNumber: 3,
          },
        ],
      },
    ],
    sourceReference: "synthetic search fixture",
    translations: [
      { code: "JSS3", displayOrder: 1, languageTag: "ja" },
      { code: "NKJV", displayOrder: 2, languageTag: "en" },
    ],
    upsertTranslations: true,
  });
  return {
    book: fixture.books.get("JHN")!,
    jss3: fixture.translations.get("JSS3")!,
    nkjv: fixture.translations.get("NKJV")!,
  };
}

beforeEach(async () => {
  await clearFixture();
  await createFixture();
});
afterEach(clearFixture);
afterAll(async () => {
  await clearFixture();
  await prisma.$disconnect();
});

describe("PostgreSQL scripture search", () => {
  it.each([
    [3, 18, "next", 3, 19, false],
    [3, 19, "next", 4, 1, true],
    [4, 1, "next", 4, 3, false],
    [4, 1, "previous", 3, 19, true],
  ] as const)(
    "navigates %s:%s %s to the adjacent existing %s:%s",
    async (
      chapter,
      verse,
      direction,
      expectedChapter,
      expectedVerse,
      crossedChapter,
    ) => {
      const result = await navigateScripture(scriptureNavigationRepository, {
        book: "JHN",
        chapter,
        verse,
        direction,
        language: "both",
      });
      expect(result).toMatchObject({
        crossedBook: false,
        crossedChapter,
        edge: null,
        item: {
          location: {
            book: "JHN",
            chapter: expectedChapter,
            verse: expectedVerse,
          },
          texts: { japanese: {}, english: {} },
        },
      });
    },
  );

  it("returns stable same-book edges", async () => {
    await expect(
      navigateScripture(scriptureNavigationRepository, {
        book: "JHN",
        chapter: 3,
        verse: 15,
        direction: "previous",
        language: "both",
      }),
    ).resolves.toEqual({
      crossedBook: false,
      crossedChapter: false,
      edge: "book-start",
      item: null,
    });
    await expect(
      navigateScripture(scriptureNavigationRepository, {
        book: "JHN",
        chapter: 4,
        verse: 3,
        direction: "next",
        language: "both",
      }),
    ).resolves.toEqual({
      crossedBook: false,
      crossedChapter: false,
      edge: "book-end",
      item: null,
    });
  });

  it("crosses the Old/New Testament boundary by canonical book order", async () => {
    const [jss3, nkjv] = await Promise.all([
      prisma.bibleTranslation.findUniqueOrThrow({ where: { code: "JSS3" } }),
      prisma.bibleTranslation.findUniqueOrThrow({ where: { code: "NKJV" } }),
    ]);
    const malachi = await prisma.bibleBook.create({
      data: { canonicalCode: "MAL", canonicalOrder: 39, testament: "OLD" },
    });
    const matthew = await prisma.bibleBook.create({
      data: { canonicalCode: "MAT", canonicalOrder: 40, testament: "NEW" },
    });
    try {
      await prisma.bibleBookName.createMany({
        data: [
          { bookId: malachi.id, translationId: jss3.id, name: "架空マラキ" },
          {
            bookId: malachi.id,
            translationId: nkjv.id,
            name: "Synthetic Malachi",
          },
          { bookId: matthew.id, translationId: jss3.id, name: "架空マタイ" },
          {
            bookId: matthew.id,
            translationId: nkjv.id,
            name: "Synthetic Matthew",
          },
        ],
      });
      await prisma.bibleVerse.createMany({
        data: [jss3, nkjv].flatMap(({ id: translationId }) => [
          {
            bookId: malachi.id,
            chapterNumber: 4,
            text: "Synthetic boundary text",
            translationId,
            verseNumber: 6,
          },
          {
            bookId: matthew.id,
            chapterNumber: 1,
            text: "Synthetic boundary text",
            translationId,
            verseNumber: 1,
          },
        ]),
      });

      await expect(
        navigateScripture(scriptureNavigationRepository, {
          book: "MAL",
          chapter: 4,
          verse: 6,
          direction: "next",
          language: "both",
        }),
      ).resolves.toMatchObject({
        crossedBook: true,
        crossedChapter: true,
        edge: null,
        item: { location: { book: "MAT", chapter: 1, verse: 1 } },
      });
      await expect(
        navigateScripture(scriptureNavigationRepository, {
          book: "MAT",
          chapter: 1,
          verse: 1,
          direction: "previous",
          language: "both",
        }),
      ).resolves.toMatchObject({
        crossedBook: true,
        item: { location: { book: "MAL", chapter: 4, verse: 6 } },
      });

      await prisma.bibleVerse.delete({
        where: {
          translationId_bookId_chapterNumber_verseNumber: {
            translationId: nkjv.id,
            bookId: matthew.id,
            chapterNumber: 1,
            verseNumber: 1,
          },
        },
      });
      await expect(
        navigateScripture(scriptureNavigationRepository, {
          book: "MAL",
          chapter: 4,
          verse: 6,
          direction: "next",
          language: "both",
        }),
      ).rejects.toMatchObject({ code: "TRANSLATION_NOT_AVAILABLE" });
    } finally {
      await prisma.bibleVerse.deleteMany({
        where: { bookId: { in: [malachi.id, matthew.id] } },
      });
      await prisma.bibleBookName.deleteMany({
        where: { bookId: { in: [malachi.id, matthew.id] } },
      });
      await prisma.bibleBook.deleteMany({
        where: { id: { in: [malachi.id, matthew.id] } },
      });
    }
  });

  it("does not skip an adjacent location with a missing requested translation", async () => {
    await prisma.bibleVerse.delete({
      where: {
        translationId_bookId_chapterNumber_verseNumber: {
          translationId: (
            await prisma.bibleTranslation.findUniqueOrThrow({
              where: { code: "NKJV" },
            })
          ).id,
          bookId: (
            await prisma.bibleBook.findUniqueOrThrow({
              where: { canonicalCode: "JHN" },
            })
          ).id,
          chapterNumber: 3,
          verseNumber: 19,
        },
      },
    });
    await expect(
      navigateScripture(scriptureNavigationRepository, {
        book: "JHN",
        chapter: 3,
        verse: 18,
        direction: "next",
        language: "both",
      }),
    ).rejects.toMatchObject({ code: "TRANSLATION_NOT_AVAILABLE" });
  });

  it("returns cascading options and intersects bilingual locations", async () => {
    expect(
      await readScriptureCatalog(scriptureCatalogRepository, {
        language: "both",
      }),
    ).toEqual({
      books: [
        {
          code: "JHN",
          englishName: "Synthetic John",
          japaneseName: "架空ヨハネ",
          name: "架空ヨハネ",
        },
      ],
      chapters: [],
      verses: [],
    });
    expect(
      await readScriptureCatalog(scriptureCatalogRepository, {
        book: "JHN",
        chapter: 3,
        language: "both",
      }),
    ).toEqual({
      books: [
        {
          code: "JHN",
          englishName: "Synthetic John",
          japaneseName: "架空ヨハネ",
          name: "架空ヨハネ",
        },
      ],
      chapters: [3, 4],
      verses: [15, 16, 17, 18, 19],
    });

    await prisma.bibleVerse.delete({
      where: {
        translationId_bookId_chapterNumber_verseNumber: {
          translationId: (
            await prisma.bibleTranslation.findUniqueOrThrow({
              where: { code: "NKJV" },
            })
          ).id,
          bookId: (
            await prisma.bibleBook.findUniqueOrThrow({
              where: { canonicalCode: "JHN" },
            })
          ).id,
          chapterNumber: 3,
          verseNumber: 19,
        },
      },
    });
    const catalog = await readScriptureCatalog(scriptureCatalogRepository, {
      book: "JHN",
      chapter: 3,
      language: "both",
    });
    expect(catalog.verses).toEqual([15, 16, 17, 18]);
  });

  it.each([
    ["ja", ["japanese"]],
    ["en", ["english"]],
    ["both", ["japanese", "english"]],
  ] as const)(
    "returns deterministic %s items with one catalog read",
    async (language, textKeys) => {
      const result = await searchScripture(scriptureSearchRepository, {
        ...baseSearch,
        language,
      });
      expect(result.items.map(({ location }) => location.verse)).toEqual([
        16, 17, 18,
      ]);
      for (const item of result.items)
        expect(Object.keys(item.texts).sort()).toEqual([...textKeys].sort());
    },
  );

  it.each([
    [{ book: "XXX" }, "BOOK_NOT_FOUND"],
    [{ chapter: 99 }, "CHAPTER_NOT_FOUND"],
    [{ startVerse: 14 }, "VERSE_RANGE_NOT_FOUND"],
  ] as const)(
    "returns %s for a missing catalog boundary",
    async (override, code) => {
      await expect(
        searchScripture(scriptureSearchRepository, {
          ...baseSearch,
          ...override,
        }),
      ).rejects.toMatchObject({ code });
    },
  );

  it("rejects a missing verse translation and a pending translation", async () => {
    await prisma.bibleVerse.delete({
      where: {
        translationId_bookId_chapterNumber_verseNumber: {
          translationId: (
            await prisma.bibleTranslation.findUniqueOrThrow({
              where: { code: "NKJV" },
            })
          ).id,
          bookId: (
            await prisma.bibleBook.findUniqueOrThrow({
              where: { canonicalCode: "JHN" },
            })
          ).id,
          chapterNumber: 3,
          verseNumber: 17,
        },
      },
    });
    await expect(
      searchScripture(scriptureSearchRepository, baseSearch),
    ).rejects.toMatchObject({
      code: "TRANSLATION_NOT_AVAILABLE",
    });

    await prisma.bibleTranslation.update({
      where: { code: "NKJV" },
      data: {
        rightsStatus: "PENDING",
        sourceReference: null,
        rightsNotice: null,
      },
    });
    await expect(
      searchScripture(scriptureSearchRepository, {
        ...baseSearch,
        language: "en",
      }),
    ).rejects.toMatchObject({ code: "TRANSLATION_NOT_AVAILABLE" });
  });

  it("uses a Bible location index for the representative bounded range", async () => {
    const book = await prisma.bibleBook.findUniqueOrThrow({
      where: { canonicalCode: "JHN" },
    });
    const translation = await prisma.bibleTranslation.findUniqueOrThrow({
      where: { code: "JSS3" },
    });
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return transaction.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN
        SELECT "verse_number", "text"
        FROM "bible_verses"
        WHERE "translation_id" = ${translation.id}::uuid
          AND "book_id" = ${book.id}::uuid
          AND "chapter_number" = 3
          AND "verse_number" BETWEEN 16 AND 18
        ORDER BY "verse_number"
      `;
    });
    expect(plan.map((row) => row["QUERY PLAN"]).join("\n")).toMatch(
      /bible_verses_(location_uk|navigation_idx)/,
    );
  });

  it("uses the navigation index for the next canonical location", async () => {
    const book = await prisma.bibleBook.findUniqueOrThrow({
      where: { canonicalCode: "JHN" },
    });
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return transaction.$queryRaw<Array<{ "QUERY PLAN": string }>>`
        EXPLAIN
        SELECT "chapter_number", "verse_number"
        FROM "bible_verses"
        WHERE "book_id" = ${book.id}::uuid
          AND ("chapter_number", "verse_number") > (3, 18)
        ORDER BY "chapter_number", "verse_number"
        LIMIT 1
      `;
    });
    expect(plan.map((row) => row["QUERY PLAN"]).join("\n")).toMatch(
      /bible_verses_(navigation_idx|location_uk)/,
    );
  });
});
