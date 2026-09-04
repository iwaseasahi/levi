import type { ChurchScope } from "@/application/auth/church-access";
import type { SlideRepository } from "@/application/slides/manage-slides";
import type {
  SlideImageInput,
  SlideImageMediaType,
} from "@/domain/slides/image";
import { SlideError, type SlideRecord } from "@/domain/slides/commands";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./client";
import { lockFolder } from "./saved-content-locks";
import { writeBookmarkOrder } from "./saved-content-ordering";

const slideRecordSelect = {
  id: true,
  title: true,
  body: true,
  contentType: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  image: {
    select: {
      mediaType: true,
      byteSize: true,
      width: true,
      height: true,
    },
  },
} satisfies Prisma.SlideSelect;

type SlideRow = Prisma.SlideGetPayload<{ select: typeof slideRecordSelect }>;

function storedMediaType(value: string): SlideImageMediaType {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp")
    return value;
  throw new Error("Invalid persisted Slide image media type");
}

function record(row: SlideRow): SlideRecord {
  const common = {
    id: row.id,
    title: row.title,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.contentType === "IMAGE") {
    if (!row.image || row.body !== null)
      throw new Error("Invalid persisted image Slide");
    return {
      ...common,
      contentType: "image",
      body: null,
      image: { ...row.image, mediaType: storedMediaType(row.image.mediaType) },
    };
  }
  if (row.body === null || row.image)
    throw new Error("Invalid persisted text Slide");
  return { ...common, body: row.body };
}

async function lockChurch(
  transaction: Prisma.TransactionClient,
  churchId: string,
) {
  const [church] = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM churches WHERE id=${churchId}::uuid FOR UPDATE`;
  if (!church) throw new SlideError("SLIDE_NOT_FOUND");
}

async function assertImageQuota(
  transaction: Prisma.TransactionClient,
  churchId: string,
  incomingBytes: number,
  bytesPerChurch: number,
  replacingSlideId?: string,
) {
  const [usage] = await transaction.$queryRaw<Array<{ bytes: bigint }>>`
    SELECT COALESCE(SUM(byte_size), 0)::bigint AS bytes
    FROM slide_images
    WHERE church_id=${churchId}::uuid
      ${replacingSlideId ? Prisma.sql`AND slide_id <> ${replacingSlideId}::uuid` : Prisma.empty}`;
  if ((usage?.bytes ?? 0n) + BigInt(incomingBytes) > BigInt(bytesPerChurch))
    throw new SlideError("SLIDE_IMAGE_QUOTA_EXCEEDED");
}

function imageData(input: SlideImageInput) {
  return {
    mediaType: input.image.mediaType,
    byteSize: input.image.byteSize,
    width: input.image.width,
    height: input.image.height,
    checksum: input.image.checksum,
    data: Buffer.from(input.image.data),
  };
}

function mutate<T>(
  scope: ChurchScope,
  id: string,
  expectedRevision: number,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (transaction) => {
    // Quota-changing paths lock Church before Slide, giving each tenant a
    // deterministic writer order and preventing concurrent quota overshoot.
    await lockChurch(transaction, scope.churchId);
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
        data: {
          title: input.title,
          body: input.body,
          contentType: "TEXT",
          churchId: scope.churchId,
        },
        select: slideRecordSelect,
      }),
    );
  },
  createImage(scope, input, bytesPerChurch) {
    return prisma.$transaction(async (transaction) => {
      await lockChurch(transaction, scope.churchId);
      await assertImageQuota(
        transaction,
        scope.churchId,
        input.image.byteSize,
        bytesPerChurch,
      );
      return record(
        await transaction.slide.create({
          data: {
            title: input.title,
            body: null,
            contentType: "IMAGE",
            churchId: scope.churchId,
            image: { create: imageData(input) },
          },
          select: slideRecordSelect,
        }),
      );
    });
  },
  async find(scope, id) {
    const row = await prisma.slide.findFirst({
      where: { id, churchId: scope.churchId },
      select: slideRecordSelect,
    });
    return row ? record(row) : null;
  },
  async findImage(scope, id, revision) {
    const row = await prisma.slideImage.findFirst({
      where: {
        slideId: id,
        churchId: scope.churchId,
        slide: { revision, contentType: "IMAGE" },
      },
      select: {
        mediaType: true,
        byteSize: true,
        width: true,
        height: true,
        checksum: true,
        data: true,
      },
    });
    return row
      ? {
          ...row,
          mediaType: storedMediaType(row.mediaType),
          data: new Uint8Array(row.data),
        }
      : null;
  },
  async getImageUsage(scope) {
    const usage = await prisma.slideImage.aggregate({
      where: { churchId: scope.churchId },
      _sum: { byteSize: true },
    });
    return usage._sum.byteSize ?? 0;
  },
  update(scope, id, expectedRevision, input) {
    return mutate(scope, id, expectedRevision, async (transaction) => {
      if (expectedRevision === 2_147_483_647)
        throw new SlideError("SLIDE_CONFLICT");
      await transaction.slideImage.deleteMany({
        where: { slideId: id, churchId: scope.churchId },
      });
      return record(
        await transaction.slide.update({
          where: { id, churchId: scope.churchId, revision: expectedRevision },
          data: {
            title: input.title,
            body: input.body,
            contentType: "TEXT",
            revision: { increment: 1 },
          },
          select: slideRecordSelect,
        }),
      );
    });
  },
  updateImage(scope, id, expectedRevision, input, bytesPerChurch) {
    return mutate(scope, id, expectedRevision, async (transaction) => {
      if (expectedRevision === 2_147_483_647)
        throw new SlideError("SLIDE_CONFLICT");
      await assertImageQuota(
        transaction,
        scope.churchId,
        input.image.byteSize,
        bytesPerChurch,
        id,
      );
      return record(
        await transaction.slide.update({
          where: { id, churchId: scope.churchId, revision: expectedRevision },
          data: {
            title: input.title,
            body: null,
            contentType: "IMAGE",
            revision: { increment: 1 },
            image: {
              upsert: {
                create: imageData(input),
                update: imageData(input),
              },
            },
          },
          select: slideRecordSelect,
        }),
      );
    });
  },
  updateImageTitle(scope, id, expectedRevision, title) {
    return mutate(scope, id, expectedRevision, async (transaction) => {
      if (expectedRevision === 2_147_483_647)
        throw new SlideError("SLIDE_CONFLICT");
      const current = await transaction.slide.findFirst({
        where: {
          id,
          churchId: scope.churchId,
          contentType: "IMAGE",
          image: { isNot: null },
        },
        select: { id: true },
      });
      if (!current) throw new SlideError("SLIDE_CONFLICT");
      return record(
        await transaction.slide.update({
          where: { id, churchId: scope.churchId, revision: expectedRevision },
          data: { title, revision: { increment: 1 } },
          select: slideRecordSelect,
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
