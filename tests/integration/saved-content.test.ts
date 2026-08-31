import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";

import { prisma } from "@/infrastructure/database/client";
import {
  createBookmark as createBookmarkUseCase,
  createSlideBookmark,
  createFolder as createFolderUseCase,
  openBookmark,
  reorderBookmarks,
  reorderFolders,
  selectFolder,
  updateFolder,
} from "@/application/saved-content/manage-saved-content";
import { savedContentRepository } from "@/infrastructure/database/saved-content-repository";
import { slideRepository } from "@/infrastructure/database/slide-repository";
import {
  clearSyntheticBibleFixture,
  createSyntheticBibleFixture,
} from "../helpers/synthetic-bible-fixture";

const codes = ["T54J", "T54E"];
const bibleCleanup = {
  bookCodes: ["T54"],
  deleteTranslationCodes: codes,
};

function tenant(churchId: string) {
  return { churchId } as ChurchScope;
}

async function clearFixture() {
  await prisma.folder.deleteMany({
    where: { church: { name: { startsWith: "test.saved-content" } } },
  });
  await prisma.church.deleteMany({
    where: { name: { startsWith: "test.saved-content" } },
  });
  await clearSyntheticBibleFixture(prisma, bibleCleanup);
}

async function createFixture() {
  const bible = await createSyntheticBibleFixture(prisma, {
    books: [
      {
        canonicalCode: "T54",
        canonicalOrder: 54,
        names: {
          T54E: { name: "Synthetic 54" },
          T54J: { name: "架空書54" },
        },
        testament: "NEW",
        verses: [1, 2, 3].map((verseNumber) => ({
          chapterNumber: 1,
          texts: {
            T54E: `Synthetic text ${verseNumber}`,
            T54J: `Synthetic text ${verseNumber}`,
          },
          verseNumber,
        })),
      },
    ],
    sourceReference: "saved-content integration fixture",
    translations: [
      { code: "T54J", displayOrder: 50, languageTag: "ja" },
      { code: "T54E", displayOrder: 51, languageTag: "en" },
    ],
  });
  const book = bible.books.get("T54")!;
  const primary = bible.translations.get("T54J")!;
  const secondary = bible.translations.get("T54E")!;
  const firstChurch = await prisma.church.create({
    data: { name: "test.saved-content first" },
  });
  const secondChurch = await prisma.church.create({
    data: { name: "test.saved-content second" },
  });
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
  it("stores owned slides as typed bookmarks and removes references with compact order on Slide deletion", async () => {
    const fixture = await createFixture();
    const scope = tenant(fixture.firstChurch.id);
    const folder = await createFolderUseCase(
      savedContentRepository,
      scope,
      "Slides",
    );
    const first = await slideRepository.create(scope, {
      title: "First slide",
      body: "First body",
      author: null,
    });
    const second = await slideRepository.create(scope, {
      title: "Second slide",
      body: "Second body",
      author: null,
    });
    const foreign = await slideRepository.create(
      tenant(fixture.secondChurch.id),
      { title: "Foreign", body: "Foreign body", author: null },
    );

    await expect(
      createSlideBookmark(savedContentRepository, scope, folder.id, first.id),
    ).resolves.toMatchObject({
      title: "First slide",
      slideId: first.id,
      position: 0,
    });
    await expect(
      createSlideBookmark(savedContentRepository, scope, folder.id, second.id),
    ).resolves.toMatchObject({
      title: "Second slide",
      slideId: second.id,
      position: 1,
    });
    await expect(
      createSlideBookmark(savedContentRepository, scope, folder.id, foreign.id),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_NOT_FOUND" });
    await expect(
      createSlideBookmark(
        savedContentRepository,
        tenant(fixture.secondChurch.id),
        folder.id,
        first.id,
      ),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_NOT_FOUND" });

    await slideRepository.delete(scope, first.id, first.revision);
    await expect(
      selectFolder(savedContentRepository, scope, folder.id),
    ).resolves.toMatchObject({
      bookmarks: [{ title: "Second slide", slideId: second.id, position: 0 }],
    });
    await expect(
      prisma.bookmark.findMany({ where: { churchId: scope.churchId } }),
    ).resolves.toHaveLength(1);
  });

  it("prepends new folders while preserving saved order and tenant isolation", async () => {
    const fixture = await createFixture();
    const scope = tenant(fixture.firstChurch.id);
    const create = (name: string) =>
      createFolderUseCase(savedContentRepository, scope, name);
    const first = await create("2026-08-30 First");
    expect(first.position).toBe(0);
    const second = await create("2026-08-29 Second");
    await expect(
      savedContentRepository.listFolderOrder(scope),
    ).resolves.toEqual([second.id, first.id]);
    await savedContentRepository.reorderFolders(scope, [first.id, second.id]);
    const foreign = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.secondChurch.id),
      "Foreign",
    );
    const third = await create("Third");
    await savedContentRepository.selectFolder(scope, second.id);
    const folders = await savedContentRepository.listFolders(scope);
    expect(folders.map(({ id }) => id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
    expect(folders.map(({ position }) => position)).toEqual([0, 1, 2]);
    await expect(
      savedContentRepository.listFolders(tenant(fixture.secondChurch.id)),
    ).resolves.toEqual([foreign]);
  });

  it("keeps new folders visible at the sidebar limit and retains pinned priority", async () => {
    const fixture = await createFixture();
    const scope = tenant(fixture.firstChurch.id);
    await prisma.folder.createMany({
      data: Array.from({ length: 20 }, (_, position) => ({
        churchId: scope.churchId,
        name: `Existing ${position}`,
        position,
      })),
    });
    const created = await createFolderUseCase(
      savedContentRepository,
      scope,
      "New",
    );
    const folders = await savedContentRepository.listFolders(scope);
    expect(folders).toHaveLength(20);
    expect(folders[0]).toMatchObject({ id: created.id });
    expect(folders.slice(1).map(({ name }) => name)).toEqual(
      Array.from({ length: 19 }, (_, index) => `Existing ${index}`),
    );
    const pinned = folders[2];
    if (!pinned) throw new Error("Expected an existing folder to pin");
    await savedContentRepository.updateFolder(scope, pinned.id, {
      isPinned: true,
    });
    const newest = await createFolderUseCase(
      savedContentRepository,
      scope,
      "Newest",
    );
    const pinnedFirst = await savedContentRepository.listFolders(scope);
    expect(pinnedFirst).toHaveLength(20);
    expect(pinnedFirst.slice(0, 3).map(({ id }) => id)).toEqual([
      pinned.id,
      newest.id,
      created.id,
    ]);
  });

  it("serializes simultaneous prepends without losing or duplicating positions", async () => {
    const fixture = await createFixture();
    const scope = tenant(fixture.firstChurch.id);
    const original = await createFolderUseCase(
      savedContentRepository,
      scope,
      "Original",
    );
    const created = await Promise.all(
      ["First concurrent", "Second concurrent", "Third concurrent"].map(
        (name) => createFolderUseCase(savedContentRepository, scope, name),
      ),
    );
    const folders = await savedContentRepository.listFolders(scope);
    expect(folders.map(({ position }) => position)).toEqual([0, 1, 2, 3]);
    expect(folders[3]).toMatchObject({ id: original.id });
    expect(new Set(folders.slice(0, 3).map(({ id }) => id))).toEqual(
      new Set(created.map(({ id }) => id)),
    );
  });

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
    const repositoryBible = await createSyntheticBibleFixture(prisma, {
      books: [],
      sourceReference: "saved-content repository fixture",
      translations: [
        { code: "JSS3", displayOrder: 1, languageTag: "ja" },
        { code: "NKJV", displayOrder: 2, languageTag: "en" },
      ],
      upsertTranslations: true,
    });
    const translations = [
      repositoryBible.translations.get("JSS3")!,
      repositoryBible.translations.get("NKJV")!,
    ];
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
      tenant(fixture.firstChurch.id),
      "First folder",
    );
    const second = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      "Second folder",
    );
    const foreign = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.secondChurch.id),
      "Foreign folder",
    );
    await expect(
      updateFolder(
        savedContentRepository,
        tenant(fixture.secondChurch.id),
        first.id,
        { isPinned: true },
      ),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_NOT_FOUND" });
    await expect(
      savedContentRepository.selectFolder(
        tenant(fixture.secondChurch.id),
        first.id,
      ),
    ).resolves.toBeNull();
    await expect(
      reorderFolders(savedContentRepository, tenant(fixture.firstChurch.id), [
        second.id,
      ]),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_CONFLICT" });
    await reorderFolders(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      [second.id, first.id],
    );

    const bookmark = await createBookmarkUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
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
    const secondBookmark = await createBookmarkUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      first.id,
      {
        title: "Second saved range",
        book: "T54",
        chapter: 1,
        startVerse: 2,
        endVerse: 3,
        language: "both",
      },
    );
    const omittedEndBookmark = await createBookmarkUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      first.id,
      {
        title: "Omitted end",
        book: "T54",
        chapter: 1,
        startVerse: 1,
        endVerse: null,
        language: "both",
      },
    );
    expect(omittedEndBookmark.search.endVerse).toBeNull();
    await expect(
      prisma.scriptureBookmark.findUniqueOrThrow({
        where: { bookmarkId: omittedEndBookmark.id },
        select: { endVerse: true },
      }),
    ).resolves.toEqual({ endVerse: null });
    await expect(
      savedContentRepository.openBookmark(
        tenant(fixture.secondChurch.id),
        bookmark.id,
      ),
    ).resolves.toBeNull();
    await expect(
      openBookmark(
        savedContentRepository,
        tenant(fixture.firstChurch.id),
        bookmark.id,
      ),
    ).resolves.toMatchObject({ search: { book: "T54", language: "both" } });
    await expect(
      reorderBookmarks(
        savedContentRepository,
        tenant(fixture.firstChurch.id),
        first.id,
        [bookmark.id],
      ),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_CONFLICT" });
    await reorderBookmarks(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      first.id,
      [secondBookmark.id, bookmark.id, omittedEndBookmark.id],
    );
    const selected = await selectFolder(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      first.id,
    );
    expect(selected.folder.lastUsedAt).not.toBeNull();
    expect(selected.bookmarks.map(({ id }) => id)).toEqual([
      secondBookmark.id,
      bookmark.id,
      omittedEndBookmark.id,
    ]);
    await expect(
      savedContentRepository.listFolders(tenant(fixture.firstChurch.id)),
    ).resolves.toEqual([
      expect.objectContaining({ id: second.id }),
      expect.objectContaining({ id: first.id }),
    ]);
    await expect(
      savedContentRepository.listFolders(tenant(fixture.secondChurch.id)),
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
    const first = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "First", position: 0 },
    });
    const second = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "Second", position: 1 },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SET CONSTRAINTS "folders_church_position_uk" DEFERRED
      `;
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

  it("serializes concurrent reorder and delete without duplicate positions", async () => {
    const fixture = await createFixture();
    const first = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      "First",
    );
    const second = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      "Second",
    );
    const third = await createFolderUseCase(
      savedContentRepository,
      tenant(fixture.firstChurch.id),
      "Third",
    );

    const [reordered, deleted] = await Promise.all([
      savedContentRepository.reorderFolders(tenant(fixture.firstChurch.id), [
        third.id,
        second.id,
        first.id,
      ]),
      savedContentRepository.deleteFolder(
        tenant(fixture.firstChurch.id),
        second.id,
      ),
    ]);
    expect(deleted).toBe(true);
    expect([true, false]).toContain(reordered);

    const remaining = await prisma.folder.findMany({
      where: { churchId: fixture.firstChurch.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    expect(remaining.map(({ position }) => position)).toEqual([0, 1]);
    expect(new Set(remaining.map(({ id }) => id))).toEqual(
      new Set([first.id, third.id]),
    );
    await expect(
      savedContentRepository.listFolderOrder(tenant(fixture.firstChurch.id)),
    ).resolves.toEqual(remaining.map(({ id }) => id));
  });

  it("rejects foreign and guessed bookmark reorder IDs without a partial update", async () => {
    const fixture = await createFixture();
    const ownFolder = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "Own", position: 0 },
    });
    const foreignFolder = await prisma.folder.create({
      data: {
        churchId: fixture.secondChurch.id,
        name: "Foreign",
        position: 0,
      },
    });
    const first = await createBookmark({
      bookId: fixture.book.id,
      churchId: fixture.firstChurch.id,
      folderId: ownFolder.id,
      position: 0,
      primaryTranslationId: fixture.primary.id,
      title: "First",
    });
    const second = await createBookmark({
      bookId: fixture.book.id,
      churchId: fixture.firstChurch.id,
      folderId: ownFolder.id,
      position: 1,
      primaryTranslationId: fixture.primary.id,
      title: "Second",
    });
    const foreign = await createBookmark({
      bookId: fixture.book.id,
      churchId: fixture.secondChurch.id,
      folderId: foreignFolder.id,
      position: 0,
      primaryTranslationId: fixture.primary.id,
      title: "Foreign",
    });
    const scope = tenant(fixture.firstChurch.id);
    const original = [first.id, second.id];

    await expect(
      savedContentRepository.reorderBookmarks(scope, ownFolder.id, [
        first.id,
        foreign.id,
      ]),
    ).resolves.toBe(false);
    await expect(
      savedContentRepository.reorderBookmarks(scope, ownFolder.id, [
        first.id,
        randomUUID(),
      ]),
    ).resolves.toBe(false);
    await expect(
      savedContentRepository.reorderBookmarks(scope, ownFolder.id, [
        first.id,
        first.id,
      ]),
    ).resolves.toBe(false);

    await expect(
      prisma.bookmark.findMany({
        where: { churchId: fixture.firstChurch.id, folderId: ownFolder.id },
        orderBy: { position: "asc" },
        select: { id: true },
      }),
    ).resolves.toEqual(original.map((id) => ({ id })));
  });

  it("serializes concurrent bookmark reorder and delete without duplicate positions", async () => {
    const fixture = await createFixture();
    const folder = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "Own", position: 0 },
    });
    const bookmarks: Awaited<ReturnType<typeof createBookmark>>[] = [];
    for (const [position, title] of ["First", "Second", "Third"].entries()) {
      bookmarks.push(
        await createBookmark({
          bookId: fixture.book.id,
          churchId: fixture.firstChurch.id,
          folderId: folder.id,
          position,
          primaryTranslationId: fixture.primary.id,
          title,
        }),
      );
    }
    const [first, second, third] = bookmarks;
    const scope = tenant(fixture.firstChurch.id);

    const [reordered, deleted] = await Promise.all([
      savedContentRepository.reorderBookmarks(scope, folder.id, [
        third!.id,
        second!.id,
        first!.id,
      ]),
      savedContentRepository.deleteBookmark(scope, second!.id),
    ]);
    expect(deleted).toBe(true);
    expect([true, false]).toContain(reordered);

    const remaining = await prisma.bookmark.findMany({
      where: { churchId: fixture.firstChurch.id, folderId: folder.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true },
    });
    expect(remaining.map(({ position }) => position)).toEqual([0, 1]);
    expect(new Set(remaining.map(({ id }) => id))).toEqual(
      new Set([first!.id, third!.id]),
    );
  });

  it("physically deletes only the folder aggregate and restricts Bible endpoints", async () => {
    const fixture = await createFixture();
    const first = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "First", position: 0 },
    });
    const second = await prisma.folder.create({
      data: { churchId: fixture.firstChurch.id, name: "Second", position: 1 },
    });
    const deleted = await createBookmark({
      bookId: fixture.book.id,
      churchId: fixture.firstChurch.id,
      folderId: first.id,
      position: 0,
      primaryTranslationId: fixture.primary.id,
      title: "Deleted",
    });
    const retained = await createBookmark({
      bookId: fixture.book.id,
      churchId: fixture.firstChurch.id,
      folderId: second.id,
      position: 0,
      primaryTranslationId: fixture.primary.id,
      title: "Retained",
    });
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
