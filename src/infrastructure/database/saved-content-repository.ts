import type { SavedContentRepository } from "@/application/saved-content/manage-saved-content";
import { prisma } from "./client";
import { resolveBookmarkCatalog } from "./saved-content-catalog";
import { lockChurch, lockFolder } from "./saved-content-locks";
import {
  bookmarkInclude,
  bookmarkView,
  folderView,
} from "./saved-content-mappers";
import {
  compactBookmarkOrderAfter,
  compactFolderOrderAfter,
  containsExactlySameIds,
  writeBookmarkOrder,
  writeFolderOrder,
} from "./saved-content-ordering";

export const savedContentRepository: SavedContentRepository = {
  async listFolders({ churchId }) {
    const pinned = await prisma.folder.findMany({
      where: { churchId, isPinned: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      take: 20,
    });
    const unpinned = await prisma.folder.findMany({
      where: { churchId, isPinned: false },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      take: Math.max(0, 20 - pinned.length),
    });
    return [...pinned, ...unpinned].map(folderView);
  },

  async listFolderOrder({ churchId }) {
    const folders = await prisma.folder.findMany({
      where: { churchId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    return folders.map(({ id }) => id);
  },

  async createFolder({ churchId }, name) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return null;
      await transaction.$executeRaw`
        SET CONSTRAINTS "folders_church_position_uk" DEFERRED
      `;
      await transaction.folder.updateMany({
        where: { churchId },
        data: { position: { increment: 1 } },
      });
      return folderView(
        await transaction.folder.create({
          data: { churchId, name, position: 0 },
        }),
      );
    });
  },

  async updateFolder({ churchId }, folderId, input) {
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

  async selectFolder({ churchId }, folderId) {
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

  async reorderFolders({ churchId }, ids) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return false;
      const current = await transaction.folder.findMany({
        where: { churchId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (
        !containsExactlySameIds(
          current.map(({ id }) => id),
          ids,
        )
      )
        return false;
      await writeFolderOrder(transaction, churchId, ids);
      return true;
    });
  },

  async deleteFolder({ churchId }, folderId) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockChurch(transaction, churchId))) return false;
      const folder = await transaction.folder.findFirst({
        where: { churchId, id: folderId },
        select: { position: true },
      });
      if (!folder) return false;
      await transaction.folder.delete({ where: { id: folderId } });
      await compactFolderOrderAfter(transaction, churchId, folder.position);
      return true;
    });
  },

  async createBookmark({ churchId }, folderId, input) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockFolder(transaction, churchId, folderId))) return null;
      const catalog = await resolveBookmarkCatalog(transaction, input);
      const position = await transaction.bookmark.count({
        where: { churchId, folderId },
      });
      const bookmark = await transaction.bookmark.create({
        data: { churchId, folderId, position, title: input.title },
      });
      await transaction.scriptureBookmark.create({
        data: {
          bookmarkId: bookmark.id,
          bookId: catalog.bookId,
          chapterNumber: input.chapter,
          startVerse: input.startVerse,
          endVerse: input.endVerse,
          primaryTranslationId: catalog.primaryTranslationId,
          ...(catalog.secondaryTranslationId
            ? { secondaryTranslationId: catalog.secondaryTranslationId }
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

  async openBookmark({ churchId }, bookmarkId) {
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

  async reorderBookmarks({ churchId }, folderId, ids) {
    return prisma.$transaction(async (transaction) => {
      if (!(await lockFolder(transaction, churchId, folderId))) return false;
      const current = await transaction.bookmark.findMany({
        where: { churchId, folderId },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (
        !containsExactlySameIds(
          current.map(({ id }) => id),
          ids,
        )
      )
        return false;
      await writeBookmarkOrder(transaction, churchId, folderId, ids);
      return true;
    });
  },

  async deleteBookmark({ churchId }, bookmarkId) {
    return prisma.$transaction(async (transaction) => {
      const candidate = await transaction.bookmark.findFirst({
        where: { churchId, id: bookmarkId },
        select: { folderId: true },
      });
      if (
        !candidate ||
        !(await lockFolder(transaction, churchId, candidate.folderId))
      )
        return false;
      const bookmark = await transaction.bookmark.findFirst({
        where: { churchId, folderId: candidate.folderId, id: bookmarkId },
        select: { folderId: true, position: true },
      });
      if (!bookmark) return false;
      await transaction.bookmark.delete({ where: { id: bookmarkId } });
      await compactBookmarkOrderAfter(
        transaction,
        churchId,
        bookmark.folderId,
        bookmark.position,
      );
      return true;
    });
  },
};
