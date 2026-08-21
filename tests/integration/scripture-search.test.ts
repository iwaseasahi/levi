import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { searchScripture } from "@/application/scripture/search-scripture";
import type { ScriptureSearch } from "@/domain/scripture/search";
import { prisma } from "@/infrastructure/database/client";
import { scriptureSearchRepository } from "@/infrastructure/database/scripture-search-repository";

const baseSearch: ScriptureSearch = {
  book: "JHN",
  chapter: 3,
  startVerse: 16,
  endVerse: 18,
  language: "both",
};

async function clearFixture() {
  await prisma.bibleVerse.deleteMany({
    where: { book: { canonicalCode: "JHN" } },
  });
  await prisma.bibleBookName.deleteMany({
    where: { book: { canonicalCode: "JHN" } },
  });
  await prisma.bibleBook.deleteMany({ where: { canonicalCode: "JHN" } });
  await prisma.bibleTranslation.updateMany({
    where: { code: { in: ["JSS3", "NKJV"] } },
    data: {
      rightsStatus: "PENDING",
      sourceReference: null,
      rightsNotice: null,
    },
  });
}

async function translation(code: "JSS3" | "NKJV", displayOrder: number) {
  return prisma.bibleTranslation.upsert({
    where: { code },
    update: {
      rightsStatus: "APPROVED",
      sourceReference: "synthetic search fixture",
      rightsNotice: "not scripture; test use only",
    },
    create: {
      code,
      name: `Synthetic ${code}`,
      languageTag: code === "JSS3" ? "ja" : "en",
      displayOrder,
      rightsStatus: "APPROVED",
      sourceReference: "synthetic search fixture",
      rightsNotice: "not scripture; test use only",
    },
  });
}

async function createFixture() {
  const [jss3, nkjv] = await Promise.all([
    translation("JSS3", 1),
    translation("NKJV", 2),
  ]);
  const book = await prisma.bibleBook.create({
    data: { canonicalCode: "JHN", canonicalOrder: 43, testament: "NEW" },
  });
  await prisma.bibleBookName.createMany({
    data: [
      { translationId: jss3.id, bookId: book.id, name: "架空ヨハネ" },
      { translationId: nkjv.id, bookId: book.id, name: "Synthetic John" },
    ],
  });
  await prisma.bibleVerse.createMany({
    data: [15, 16, 17, 18, 19].flatMap((verse) => [
      {
        translationId: jss3.id,
        bookId: book.id,
        chapterNumber: 3,
        verseNumber: verse,
        text: `架空の日本語 ${verse}`,
      },
      {
        translationId: nkjv.id,
        bookId: book.id,
        chapterNumber: 3,
        verseNumber: verse,
        text: `Synthetic English ${verse}`,
      },
    ]),
  });
  return { book, jss3, nkjv };
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
});
