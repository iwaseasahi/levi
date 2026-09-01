import type { ChurchScope } from "@/application/auth/church-access";
import type { SlideRepository } from "@/application/slides/manage-slides";
import { SlideError, type SlideRecord } from "@/domain/slides/commands";
import type { Prisma, Slide } from "@/generated/prisma/client";
import { prisma } from "./client";
import { lockFolder } from "./saved-content-locks";
import { writeBookmarkOrder } from "./saved-content-ordering";

function record(row: Slide): SlideRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mutate<T>(
  scope: ChurchScope,
  id: string,
  expectedRevision: number,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (transaction) => {
    // Lock only an owned row; foreign and missing UUIDs are indistinguishable.
    const [current] = await transaction.$queryRaw<Array<{ revision: number }>>`
      SELECT revision FROM slides WHERE id=${id}::uuid AND church_id=${scope.churchId}::uuid FOR UPDATE`;
    if (!current) throw new SlideError("SLIDE_NOT_FOUND");
    if (current.revision !== expectedRevision)
      throw new SlideError("SLIDE_CONFLICT");
    return operation(transaction);
  });
}

export const slideRepository: SlideRepository = {
  async create(scope, input) {
    return record(
      await prisma.slide.create({
        data: { ...input, churchId: scope.churchId },
      }),
    );
  },
  async find(scope, id) {
    const row = await prisma.slide.findFirst({
      where: { id, churchId: scope.churchId },
    });
    return row ? record(row) : null;
  },
  update(scope, id, expectedRevision, input) {
    return mutate(scope, id, expectedRevision, async (transaction) => {
      if (expectedRevision === 2_147_483_647)
        throw new SlideError("SLIDE_CONFLICT");
      return record(
        await transaction.slide.update({
          where: { id, churchId: scope.churchId, revision: expectedRevision },
          data: { ...input, revision: { increment: 1 } },
        }),
      );
    });
  },
  delete(scope, id, expectedRevision) {
    return mutate(scope, id, expectedRevision, async (transaction) => {
      const references = await transaction.bookmark.findMany({
        where: { churchId: scope.churchId, slide: { slideId: id } },
        select: { folderId: true },
      });
      const folderIds = [
        ...new Set(references.map(({ folderId }) => folderId)),
      ].sort();
      for (const folderId of folderIds) {
        if (!(await lockFolder(transaction, scope.churchId, folderId)))
          throw new SlideError("SLIDE_CONFLICT");
      }
      await transaction.bookmark.deleteMany({
        where: { churchId: scope.churchId, slide: { slideId: id } },
      });
      for (const folderId of folderIds) {
        const remaining = await transaction.bookmark.findMany({
          where: { churchId: scope.churchId, folderId },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        await writeBookmarkOrder(
          transaction,
          scope.churchId,
          folderId,
          remaining.map(({ id: bookmarkId }) => bookmarkId),
        );
      }
      await transaction.slide.delete({
        where: { id, churchId: scope.churchId, revision: expectedRevision },
      });
    });
  },
};
