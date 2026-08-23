import type { Prisma } from "@/generated/prisma/client";

export function containsExactlySameIds(
  current: readonly string[],
  submitted: readonly string[],
) {
  if (current.length !== submitted.length) return false;
  const submittedSet = new Set(submitted);
  return (
    submittedSet.size === submitted.length &&
    current.every((id) => submittedSet.has(id))
  );
}

export async function writeFolderOrder(
  transaction: Prisma.TransactionClient,
  churchId: string,
  ids: readonly string[],
) {
  await transaction.$executeRaw`
    SET CONSTRAINTS "folders_church_position_uk" DEFERRED
  `;
  for (const [position, id] of ids.entries()) {
    await transaction.folder.updateMany({
      where: { churchId, id },
      data: { position },
    });
  }
}

export async function compactFolderOrderAfter(
  transaction: Prisma.TransactionClient,
  churchId: string,
  position: number,
) {
  await transaction.$executeRaw`
    SET CONSTRAINTS "folders_church_position_uk" DEFERRED
  `;
  await transaction.folder.updateMany({
    where: { churchId, position: { gt: position } },
    data: { position: { decrement: 1 } },
  });
}

export async function writeBookmarkOrder(
  transaction: Prisma.TransactionClient,
  churchId: string,
  folderId: string,
  ids: readonly string[],
) {
  await transaction.$executeRaw`
    SET CONSTRAINTS "bookmarks_folder_position_uk" DEFERRED
  `;
  for (const [position, id] of ids.entries()) {
    await transaction.bookmark.updateMany({
      where: { churchId, folderId, id },
      data: { position },
    });
  }
}

export async function compactBookmarkOrderAfter(
  transaction: Prisma.TransactionClient,
  churchId: string,
  folderId: string,
  position: number,
) {
  await transaction.$executeRaw`
    SET CONSTRAINTS "bookmarks_folder_position_uk" DEFERRED
  `;
  await transaction.bookmark.updateMany({
    where: { churchId, folderId, position: { gt: position } },
    data: { position: { decrement: 1 } },
  });
}
