import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/infrastructure/database/client";
import {
  createBookmark as createBookmarkUseCase,
  createFolder as createFolderUseCase,
  openBookmark,
  reorderFolders,
  selectFolder,
  updateFolder,
} from "@/application/saved-content/manage-saved-content";
import { savedContentRepository } from "@/infrastructure/database/saved-content-repository";

const codes = ["T54J", "T54E"];

async function clearFixture() {
  await prisma.folder.deleteMany({
    where: { church: { name: { startsWith: "test.saved-content" } } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: "test.saved-content" } },
  });
  await prisma.bibleVerse.deleteMany({
    where: { book: { canonicalCode: "T54" } },
  });
  await prisma.bibleBookName.deleteMany({
    where: { book: { canonicalCode: "T54" } },
  });
  await prisma.bibleBook.deleteMany({ where: { canonicalCode: "T54" } });
  await prisma.bibleTranslation.deleteMany({ where: { code: { in: codes } } });
}

async function createFixture() {
  const [primary, secondary] = await Promise.all(
    codes.map((code, index) =>
      prisma.bibleTranslation.create({
        data: {
          code,
          displayOrder: 50 + index,
          languageTag: index === 0 ? "ja" : "en",
          name: `Synthetic ${code}`,
          rightsNotice: "synthetic fixture only",
          rightsStatus: "APPROVED",
          sourceReference: "saved-content integration fixture",
        },
      }),
    ),
  );
  const book = await prisma.bibleBook.create({
    data: { canonicalCode: "T54", canonicalOrder: 54, testament: "NEW" },
  });
  await prisma.bibleBookName.createMany({
    data: [
      { bookId: book.id, translationId: primary!.id, name: "架空書54" },
      { bookId: book.id, translationId: secondary!.id, name: "Synthetic 54" },
    ],
  });
  await prisma.bibleVerse.createMany({
    data: [primary!, secondary!].flatMap(({ id: translationId }) =>
      [1, 2, 3].map((verseNumber) => ({
        bookId: book.id,
        chapterNumber: 1,
        text: `Synthetic text ${verseNumber}`,
        translationId,
        verseNumber,
      })),
    ),
  });
  const [firstChurch, secondChurch] = await Promise.all([
    prisma.church.create({ data: { name: "test.saved-content first" } }),
    prisma.church.create({ data: { name: "test.saved-content second" } }),
  ]);
  return {
    book,
    firstChurch,
    primary: primary!,
    secondChurch,
    secondary: secondary!,
  };
}

async function createBookmark(input: {
  churchId: string;
  folderId: string;
  title: string;
  position: number;
  bookId: string;
  primaryTranslationId: string;
  secondaryTranslationId?: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const bookmark = await transaction.bookmark.create({
      data: {
        churchId: input.churchId,
        folderId: input.folderId,
        position: input.position,
        title: input.title,
      },
    });
    await transaction.scriptureBookmark.create({
      data: {
        bookmarkId: bookmark.id,
        bookId: input.bookId,
        chapterNumber: 1,
        endVerse: 3,
        primaryTranslationId: input.primaryTranslationId,
        ...(input.secondaryTranslationId
          ? { secondaryTranslationId: input.secondaryTranslationId }
          : {}),
        startVerse: 1,
      },
    });
    return bookmark;
  });
}

beforeEach(clearFixture);
afterEach(clearFixture);
afterAll(async () => {
  await clearFixture();
  await prisma.$disconnect();
});

describe("saved-content database contract", () => {
  it("requires exactly one typed scripture payload at commit", async () => {
    const fixture = await createFixture();
    const folder = await prisma.folder.create({
      data: {
        churchId: fixture.firstChurch.id,
        name: "Test folder",
        position: 0,
      },
    });
    await expect(
      prisma.bookmark.create({
        data: {
          churchId: fixture.firstChurch.id,
          folderId: folder.id,
          position: 0,
          title: "Missing subtype",
        },
      }),
    ).rejects.toThrow();
    await expect(
      createBookmark({
        bookId: fixture.book.id,
        churchId: fixture.firstChurch.id,
        folderId: folder.id,
        position: 0,
        primaryTranslationId: fixture.primary.id,
        secondaryTranslationId: fixture.secondary.id,
        title: "Valid typed bookmark",
      }),
    ).resolves.toMatchObject({ title: "Valid typed bookmark" });
  });

  it("enforces tenant scope through repository and use-case operations", async () => {
    const fixture = await createFixture();
    const translations = await Promise.all(
      (["JSS3", "NKJV"] as const).map((code, index) =>
        prisma.bibleTranslation.upsert({
          where: { code },
          update: {
            rightsNotice: "synthetic fixture only",
            rightsStatus: "APPROVED",
            sourceReference: "saved-content repository fixture",
          },
          create: {
            code,
            displayOrder: index + 1,
            languageTag: index === 0 ? "ja" : "en",
            name: `Synthetic ${code}`,
            rightsNotice: "synthetic fixture only",
            rightsStatus: "APPROVED",
            sourceReference: "saved-content repository fixture",
          },
        }),
      ),
    );
    await prisma.bibleVerse.createMany({
      data: translations.flatMap(({ id: translationId }) =>
        [1, 2, 3].map((verseNumber) => ({
          bookId: fixture.book.id,
          chapterNumber: 1,
          text: `Synthetic repository text ${verseNumber}`,
          translationId,
          verseNumber,
        })),
      ),
    });

    const first = await createFolderUseCase(
      savedContentRepository,
      fixture.firstChurch.id,
      "First folder",
    );
    const second = await createFolderUseCase(
      savedContentRepository,
      fixture.firstChurch.id,
      "Second folder",
    );
    const foreign = await createFolderUseCase(
      savedContentRepository,
      fixture.secondChurch.id,
      "Foreign folder",
    );
    await expect(
      updateFolder(savedContentRepository, fixture.secondChurch.id, first.id, {
        isPinned: true,
      }),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_NOT_FOUND" });
    await expect(
      savedContentRepository.selectFolder(fixture.secondChurch.id, first.id),
    ).resolves.toBeNull();
    await expect(
      reorderFolders(savedContentRepository, fixture.firstChurch.id, [
        second.id,
      ]),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_CONFLICT" });
    await reorderFolders(savedContentRepository, fixture.firstChurch.id, [
      second.id,
      first.id,
    ]);

    const bookmark = await createBookmarkUseCase(
      savedContentRepository,
      fixture.firstChurch.id,
      first.id,
      {
        title: "Saved range",
        book: "T54",
        chapter: 1,
        startVerse: 1,
        endVerse: 3,
        language: "both",
      },
    );
    await expect(
      savedContentRepository.openBookmark(fixture.secondChurch.id, bookmark.id),
    ).resolves.toBeNull();
    await expect(
      openBookmark(savedContentRepository, fixture.firstChurch.id, bookmark.id),
    ).resolves.toMatchObject({ search: { book: "T54", language: "both" } });
    const selected = await selectFolder(
      savedContentRepository,
      fixture.firstChurch.id,
      first.id,
    );
    expect(selected.folder.lastUsedAt).not.toBeNull();
    expect(selected.bookmarks).toHaveLength(1);
    await expect(
      savedContentRepository.listFolders(fixture.secondChurch.id),
    ).resolves.toEqual([expect.objectContaining({ id: foreign.id })]);
  });

  it("rejects cross-tenant folder ownership and invalid endpoints", async () => {
    const fixture = await createFixture();
    const folder = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "First", position: 0 },
    });
    await expect(
      prisma.$transaction(async (transaction) => {
        const bookmark = await transaction.bookmark.create({
          data: {
            churchId: fixture.secondChurch.id,
            folderId: folder.id,
            position: 0,
            title: "Foreign",
          },
        });
        await transaction.scriptureBookmark.create({
          data: {
            bookmarkId: bookmark.id,
            bookId: fixture.book.id,
            chapterNumber: 1,
            endVerse: 3,
            primaryTranslationId: fixture.primary.id,
            startVerse: 1,
          },
        });
      }),
    ).rejects.toThrow();
    await expect(
      createBookmark({
        bookId: fixture.book.id,
        churchId: fixture.firstChurch.id,
        folderId: folder.id,
        position: 0,
        primaryTranslationId: fixture.primary.id,
        secondaryTranslationId: fixture.primary.id,
        title: "Duplicate translation",
      }),
    ).rejects.toThrow();
  });

  it("supports deferred complete-set reorder and exposes raw constraints", async () => {
    const fixture = await createFixture();
    const [first, second] = await Promise.all([
      prisma.folder.create({
        data: { churchId: fixture.firstChurch.id, name: "First", position: 0 },
      }),
      prisma.folder.create({
        data: { churchId: fixture.firstChurch.id, name: "Second", position: 1 },
      }),
    ]);
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        'SET CONSTRAINTS "folders_church_position_uk" DEFERRED',
      );
      await transaction.folder.update({
        where: { id: first.id },
        data: { position: 1 },
      });
      await transaction.folder.update({
        where: { id: second.id },
        data: { position: 0 },
      });
    });
    await expect(
      prisma.folder.findMany({
        where: { churchId: fixture.firstChurch.id },
        orderBy: { position: "asc" },
        select: { id: true },
      }),
    ).resolves.toEqual([{ id: second.id }, { id: first.id }]);
    const constraints = await prisma.$queryRaw<
      Array<{ condeferrable: boolean; conname: string }>
    >`
      SELECT conname, condeferrable
      FROM pg_constraint
      WHERE conname IN (
        'folders_church_position_uk',
        'bookmarks_folder_position_uk',
        'bookmarks_scripture_total_ck',
        'scripture_bookmarks_total_ck'
      )
      ORDER BY conname
    `;
    expect(constraints).toHaveLength(4);
    expect(constraints.every(({ condeferrable }) => condeferrable)).toBe(true);
  });

  it("physically deletes only the folder aggregate and restricts Bible endpoints", async () => {
    const fixture = await createFixture();
    const [first, second] = await Promise.all([
      prisma.folder.create({
        data: { churchId: fixture.firstChurch.id, name: "First", position: 0 },
      }),
      prisma.folder.create({
        data: { churchId: fixture.firstChurch.id, name: "Second", position: 1 },
      }),
    ]);
    const [deleted, retained] = await Promise.all([
      createBookmark({
        bookId: fixture.book.id,
        churchId: fixture.firstChurch.id,
        folderId: first.id,
        position: 0,
        primaryTranslationId: fixture.primary.id,
        title: "Deleted",
      }),
      createBookmark({
        bookId: fixture.book.id,
        churchId: fixture.firstChurch.id,
        folderId: second.id,
        position: 0,
        primaryTranslationId: fixture.primary.id,
        title: "Retained",
      }),
    ]);
    await expect(
      prisma.bibleVerse.deleteMany({
        where: { bookId: fixture.book.id, verseNumber: 1 },
      }),
    ).rejects.toThrow();
    await prisma.folder.delete({ where: { id: first.id } });
    await expect(
      prisma.bookmark.findUnique({ where: { id: deleted.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.bookmark.findUnique({ where: { id: retained.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.bibleVerse.count({ where: { bookId: fixture.book.id } }),
    ).resolves.toBe(6);
  });
});
