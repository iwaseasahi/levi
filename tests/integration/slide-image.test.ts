import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import { createSlideService } from "@/application/slides/manage-slides";
import type { NormalizedSlideImage } from "@/domain/slides/image";
import { prisma } from "@/infrastructure/database/client";
import { slideRepository } from "@/infrastructure/database/slide-repository";

const prefix = "test.slide-image.";
async function scope() {
  const church = await prisma.church.create({
    data: { name: `${prefix}${randomUUID()}` },
  });
  return { churchId: church.id } as ChurchScope;
}
function image(values: number[]): NormalizedSlideImage {
  const data = new Uint8Array(values);
  return {
    mediaType: "image/png",
    byteSize: data.byteLength,
    width: 1,
    height: 1,
    checksum: createHash("sha256").update(data).digest("hex"),
    data,
  };
}

afterEach(() =>
  prisma.church.deleteMany({ where: { name: { startsWith: prefix } } }),
);
afterAll(() => prisma.$disconnect());

describe("scoped Slide image persistence", () => {
  it("stores bytes separately, reads them explicitly, renames, and converts atomically", async () => {
    const owner = await scope();
    const service = createSlideService(slideRepository, {
      imageBytesPerChurch: 100,
    });
    const created = await service.createImage(
      owner,
      " Image ",
      image([1, 2, 3]),
    );
    expect(created).toMatchObject({
      contentType: "image",
      title: "Image",
      body: null,
      image: { mediaType: "image/png", byteSize: 3, width: 1, height: 1 },
    });
    expect(created).not.toHaveProperty("image.data");
    expect(created).not.toHaveProperty("image.checksum");
    expect(await service.getImage(owner, created.id, 1)).toMatchObject({
      data: new Uint8Array([1, 2, 3]),
    });
    await expect(service.getImageUsage(owner)).resolves.toBe(3);

    const renamed = await service.update(owner, created.id, {
      expectedRevision: 1,
      input: { contentType: "image", title: "Renamed" },
    });
    expect(renamed).toMatchObject({ title: "Renamed", revision: 2 });
    expect(await service.getImage(owner, created.id, 2)).toMatchObject({
      data: new Uint8Array([1, 2, 3]),
    });

    const text = await service.update(owner, created.id, {
      expectedRevision: 2,
      input: { title: "Text", body: "Now text" },
    });
    expect(text).toMatchObject({
      title: "Text",
      body: "Now text",
      revision: 3,
    });
    expect(text).not.toHaveProperty("contentType");
    await expect(service.getImage(owner, created.id, 3)).rejects.toMatchObject({
      code: "SLIDE_NOT_FOUND",
    });
    await expect(
      prisma.slideImage.findUnique({ where: { slideId: created.id } }),
    ).resolves.toBeNull();
  });

  it("makes foreign, missing, stale, and text image reads indistinguishable", async () => {
    const [owner, other] = await Promise.all([scope(), scope()]);
    const service = createSlideService(slideRepository, {
      imageBytesPerChurch: 100,
    });
    const foreign = await service.createImage(other, "Foreign", image([1]));
    const text = await service.create(owner, { title: "Text", body: "Body" });
    for (const [id, revision] of [
      [foreign.id, 1],
      [randomUUID(), 1],
      [text.id, 1],
      [foreign.id, 2],
    ] as const) {
      await expect(service.getImage(owner, id, revision)).rejects.toMatchObject(
        {
          code: "SLIDE_NOT_FOUND",
        },
      );
    }
  });

  it("serializes concurrent quota writers and frees replacement/deletion bytes", async () => {
    const owner = await scope();
    const service = createSlideService(slideRepository, {
      imageBytesPerChurch: 5,
    });
    const writes = await Promise.allSettled([
      service.createImage(owner, "First", image([1, 2, 3])),
      service.createImage(owner, "Second", image([4, 5, 6])),
    ]);
    expect(writes.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(writes.find(({ status }) => status === "rejected")).toMatchObject({
      reason: { code: "SLIDE_IMAGE_QUOTA_EXCEEDED" },
    });
    const [stored] = await prisma.slide.findMany({
      where: { churchId: owner.churchId },
    });
    expect(stored).toBeDefined();
    const replaced = await service.updateImage(
      owner,
      stored!.id,
      stored!.revision,
      "Replacement",
      image([7, 8, 9, 10, 11]),
    );
    await expect(
      service.createImage(owner, "Over", image([1])),
    ).rejects.toMatchObject({ code: "SLIDE_IMAGE_QUOTA_EXCEEDED" });
    await service.delete(owner, replaced.id, {
      expectedRevision: replaced.revision,
    });
    await expect(
      service.createImage(owner, "After delete", image([1, 2, 3, 4, 5])),
    ).resolves.toMatchObject({ contentType: "image" });
  });

  it("cascades image bytes with Slide and Church deletion", async () => {
    const owner = await scope();
    const service = createSlideService(slideRepository, {
      imageBytesPerChurch: 100,
    });
    const slide = await service.createImage(owner, "Delete", image([1, 2]));
    await prisma.church.delete({ where: { id: owner.churchId } });
    await expect(
      prisma.slideImage.findUnique({ where: { slideId: slide.id } }),
    ).resolves.toBeNull();
  });
});
