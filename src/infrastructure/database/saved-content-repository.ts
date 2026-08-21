import { Prisma } from "@/generated/prisma/client";
import type { SavedContentRepository } from "@/application/saved-content/manage-saved-content";
import {
  languageFromTranslationCodes,
  SavedContentError,
  type FolderSummary,
} from "@/domain/saved-content";
import { requiredTranslations } from "@/domain/scripture/search";
import { prisma } from "./client";

type SavedBookmarkRow = Prisma.BookmarkGetPayload<{
  include: {
    scripture: {
      include: {
        book: true;
        primaryTranslation: true;
        secondaryTranslation: true;
      };
    };
  };
}>;

function folderView(folder: {
  id: string;
  name: string;
  isPinned: boolean;
  position: number;
  lastUsedAt: Date | null;
}): FolderSummary {
  return {
    id: folder.id,
    name: folder.name,
    isPinned: folder.isPinned,
    position: folder.position,
    lastUsedAt: folder.lastUsedAt?.toISOString() ?? null,
  };
}

function bookmarkView(bookmark: SavedBookmarkRow) {
  const scripture = bookmark.scripture;
  if (!scripture) throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
  return {
    id: bookmark.id,
    folderId: bookmark.folderId,
    position: bookmark.position,
    title: bookmark.title,
    search: {
      book: scripture.book.canonicalCode,
      chapter: scripture.chapterNumber,
      startVerse: scripture.startVerse,
      endVerse: scripture.endVerse,
      language: languageFromTranslationCodes(
        scripture.primaryTranslation.code,
        scripture.secondaryTranslation?.code ?? null,
      ),
    },
  };
}

const bookmarkInclude = {
  scripture: {
    include: {
      book: true,
      primaryTranslation: true,
      secondaryTranslation: true,
    },
  },
} as const;

async function lockChurch(
  transaction: Prisma.TransactionClient,
  churchId: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "churches" WHERE "id" = ${churchId}::uuid FOR UPDATE
  `;
  return rows.length === 1;
}

async function lockFolder(
  transaction: Prisma.TransactionClient,
  churchId: string,
  folderId: string,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "folders"
    WHERE "id" = ${folderId}::uuid AND "church_id" = ${churchId}::uuid
    FOR UPDATE
  `;
  return rows.length === 1;
}

function sameIdSet(current: string[], submitted: string[]) {
  return (
    current.length === submitted.length &&
    current.every((id) => submitted.includes(id))
  );
}

export const savedContentRepository: SavedContentRepository = {
  async listFolders(churchId) {
    const pinned = await prisma.folder.findMany({
      where: { churchId, isPinned: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      take: 20,
    });
    const recent = await prisma.folder.findMany({
      where: { churchId, isPinned: false },
      orderBy: [
        { lastUsedAt: { sort: "desc", nulls: "last" } },
        { position: "asc" },
        { id: "asc" },
      ],
      take: Math.max(0, 20 - pinned.length),
    });
    return [...pinned, ...recent].map(folderView);
  },

  async listFolderOrder(churchId) {
    const folders = await prisma.folder.findMany({
      where: { churchId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    return folders.map(({ id }) => id);
  },

  async createFolder(churchId, name) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return null;
      const position = await transaction.folder.count({ where: { churchId } });
      return folderView(
        await transaction.folder.create({
          data: { churchId, name, position },
        }),
      );
    });
  },

  async updateFolder(churchId, folderId, input) {
    const changed = await prisma.folder.updateMany({
      where: { churchId, id: folderId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      },
    });
    if (changed.count !== 1) return null;
    const folder = await prisma.folder.findFirst({
      where: { churchId, id: folderId },
    });
    return folder ? folderView(folder) : null;
  },

  async selectFolder(churchId, folderId) {
    return prisma.$transaction(async (transaction) => {
      const changed = await transaction.folder.updateMany({
        where: { churchId, id: folderId },
        data: { lastUsedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      const folder = await transaction.folder.findFirstOrThrow({
        where: { churchId, id: folderId },
      });
      const bookmarks = await transaction.bookmark.findMany({
        where: { churchId, folderId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: bookmarkInclude,
      });
      return {
        folder: folderView(folder),
        bookmarks: bookmarks.map(bookmarkView),
      };
    });
  },

  async reorderFolders(churchId, ids) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return false;
      const current = await transaction.folder.findMany({
        where: { churchId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (
        !sameIdSet(
          current.map(({ id }) => id),
          ids,
        )
      )
        return false;
      await transaction.$executeRawUnsafe(
        'SET CONSTRAINTS "folders_church_position_uk" DEFERRED',
      );
      for (const [position, id] of ids.entries())
        await transaction.folder.updateMany({
          where: { churchId, id },
          data: { position },
        });
      return true;
    });
  },

  async deleteFolder(churchId, folderId) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return false;
      const folder = await transaction.folder.findFirst({
        where: { churchId, id: folderId },
        select: { position: true },
      });
      if (!folder) return false;
      await transaction.$executeRawUnsafe(
        'SET CONSTRAINTS "folders_church_position_uk" DEFERRED',
      );
      await transaction.folder.delete({ where: { id: folderId } });
      await transaction.folder.updateMany({
        where: { churchId, position: { gt: folder.position } },
        data: { position: { decrement: 1 } },
      });
      return true;
    });
  },

  async createBookmark(churchId, folderId, input) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockFolder(transaction, churchId, folderId))) return null;
      const book = await transaction.bibleBook.findUnique({
        where: { canonicalCode: input.book },
      });
      const codes = [...requiredTranslations(input.language)];
      const translations = await transaction.bibleTranslation.findMany({
        where: { code: { in: codes }, rightsStatus: "APPROVED" },
      });
      if (!book || translations.length !== codes.length)
        throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
      const byCode = new Map(translations.map((item) => [item.code, item]));
      const expectedCount = input.endVerse - input.startVerse + 1;
      for (const translation of translations) {
        const count = await transaction.bibleVerse.count({
          where: {
            translationId: translation.id,
            bookId: book.id,
            chapterNumber: input.chapter,
            verseNumber: { gte: input.startVerse, lte: input.endVerse },
          },
        });
        if (count !== expectedCount)
          throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
      }
      const position = await transaction.bookmark.count({
        where: { churchId, folderId },
      });
      const bookmark = await transaction.bookmark.create({
        data: { churchId, folderId, position, title: input.title },
      });
      const primaryCode = input.language === "en" ? "NKJV" : "JSS3";
      const secondaryCode = input.language === "both" ? "NKJV" : null;
      await transaction.scriptureBookmark.create({
        data: {
          bookmarkId: bookmark.id,
          bookId: book.id,
          chapterNumber: input.chapter,
          startVerse: input.startVerse,
          endVerse: input.endVerse,
          primaryTranslationId: byCode.get(primaryCode)!.id,
          ...(secondaryCode
            ? { secondaryTranslationId: byCode.get(secondaryCode)!.id }
            : {}),
        },
      });
      return bookmarkView(
        await transaction.bookmark.findUniqueOrThrow({
          where: { id: bookmark.id },
          include: bookmarkInclude,
        }),
      );
    });
  },

  async openBookmark(churchId, bookmarkId) {
    return prisma.$transaction(async (transaction) => {
      const bookmark = await transaction.bookmark.findFirst({
        where: { churchId, id: bookmarkId },
        include: bookmarkInclude,
      });
      if (!bookmark) return null;
      await transaction.folder.updateMany({
        where: { churchId, id: bookmark.folderId },
        data: { lastUsedAt: new Date() },
      });
      return bookmarkView(bookmark);
    });
  },

  async reorderBookmarks(churchId, folderId, ids) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockFolder(transaction, churchId, folderId))) return false;
      const current = await transaction.bookmark.findMany({
        where: { churchId, folderId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (
        !sameIdSet(
          current.map(({ id }) => id),
          ids,
        )
      )
        return false;
      await transaction.$executeRawUnsafe(
        'SET CONSTRAINTS "bookmarks_folder_position_uk" DEFERRED',
      );
      for (const [position, id] of ids.entries())
        await transaction.bookmark.updateMany({
          where: { churchId, folderId, id },
          data: { position },
        });
      return true;
    });
  },

  async deleteBookmark(churchId, bookmarkId) {
    return prisma.$transaction(async (transaction) => {
      const bookmark = await transaction.bookmark.findFirst({
        where: { churchId, id: bookmarkId },
        select: { folderId: true, position: true },
      });
      if (
        !bookmark ||
        !(await lockFolder(transaction, churchId, bookmark.folderId))
      )
        return false;
      await transaction.$executeRawUnsafe(
        'SET CONSTRAINTS "bookmarks_folder_position_uk" DEFERRED',
      );
      await transaction.bookmark.delete({ where: { id: bookmarkId } });
      await transaction.bookmark.updateMany({
        where: {
          churchId,
          folderId: bookmark.folderId,
          position: { gt: bookmark.position },
        },
        data: { position: { decrement: 1 } },
      });
      return true;
    });
  },
};
