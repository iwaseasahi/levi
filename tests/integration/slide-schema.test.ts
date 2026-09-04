import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/client";

const namespace = "test.slide-schema.";
const fields = { title: "Synthetic slide", body: "First\n\n\n\nSecond" };
async function church() {
  return prisma.church.create({
    data: { name: `${namespace}${randomUUID()}` },
  });
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: namespace } } });
  await prisma.church.deleteMany({
    where: { name: { startsWith: namespace } },
  });
});
afterAll(() => prisma.$disconnect());

describe("Slide database contract", () => {
  it("persists duplicate titles and code point boundaries", async () => {
    const owner = await church();
    const first = await prisma.slide.create({
      data: { ...fields, churchId: owner.id },
    });
    const second = await prisma.slide.create({
      data: { ...fields, churchId: owner.id },
    });
    expect(first.revision).toBe(1);
    expect(second.id).not.toBe(first.id);
    expect(first.createdAt).toBeInstanceOf(Date);
    const unicode = await prisma.slide.create({
      data: {
        churchId: owner.id,
        title: "😀".repeat(200),
        body: "😀".repeat(100_000),
      },
    });
    expect([...unicode.body!]).toHaveLength(100_000);
    await expect(
      prisma.slide.update({
        where: { id: unicode.id },
        data: { revision: 2, body: " Updated\n" },
      }),
    ).resolves.toMatchObject({ revision: 2, body: " Updated\n" });
  });

  it.each([
    { title: "" },
    { title: " leading" },
    { title: "trailing " },
    { title: "line\nbreak" },
    { title: "line\rbreak" },
    { title: "tab\tinside" },
    { title: "😀".repeat(201) },
    { body: "" },
    { body: " \t\n" },
    { body: "CR\rLF" },
    { body: "x".repeat(100_001) },
    { body: "nul\0" },
    { revision: 0 },
    { revision: -1 },
  ])("rejects invalid persisted fields (case %#)", async (invalid) => {
    const owner = await church();
    await expect(
      prisma.slide.create({
        data: { ...fields, ...invalid, churchId: owner.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.slide.count({ where: { churchId: owner.id } }),
    ).resolves.toBe(0);
  });

  it("rejects absent owners and null required fields at the SQL boundary", async () => {
    await expect(
      prisma.slide.create({ data: { ...fields, churchId: randomUUID() } }),
    ).rejects.toThrow();
    const owner = await church();
    await expect(
      prisma.$executeRaw`INSERT INTO slides(church_id,title,body) VALUES (${owner.id}::uuid,NULL,'body')`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`INSERT INTO slides(church_id,title,body) VALUES (${owner.id}::uuid,'title',NULL)`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`INSERT INTO slides(church_id,title,body) VALUES (NULL,'title','body')`,
    ).rejects.toThrow();
  });

  it("installs exactly the aggregate columns, named constraints and ordered indexes", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='slides' ORDER BY ordinal_position`;
    expect(columns.map((row) => row.column_name)).toEqual([
      "id",
      "church_id",
      "title",
      "body",
      "revision",
      "created_at",
      "updated_at",
      "content_type",
    ]);
    const constraints = await prisma.$queryRaw<
      Array<{ conname: string; confdeltype: string }>
    >`
      SELECT conname, confdeltype::text FROM pg_constraint WHERE conrelid='slides'::regclass`;
    expect(constraints.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        "slides_pkey",
        "slides_title_valid",
        "slides_content_valid",
        "slides_revision_positive",
        "slides_church_id_fkey",
      ]),
    );
    expect(constraints.map((row) => row.conname)).not.toContain(
      "slides_author_valid",
    );
    expect(
      constraints.find((row) => row.conname === "slides_church_id_fkey")
        ?.confdeltype,
    ).toBe("c");
    const indexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename='slides'`;
    expect(
      indexes.find((row) => row.indexname === "slides_church_created_id_idx")
        ?.indexdef,
    ).toContain("(church_id, created_at DESC, id DESC)");
    expect(
      indexes.find((row) => row.indexname === "slides_church_updated_id_idx")
        ?.indexdef,
    ).toContain("(church_id, updated_at DESC, id DESC)");
  });

  it("installs bounded one-to-one image binary storage", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='slide_images' ORDER BY ordinal_position`;
    expect(columns.map((row) => row.column_name)).toEqual([
      "slide_id",
      "church_id",
      "media_type",
      "byte_size",
      "width",
      "height",
      "checksum",
      "data",
      "created_at",
      "updated_at",
    ]);
    const constraints = await prisma.$queryRaw<
      Array<{ conname: string; confdeltype: string }>
    >`SELECT conname,confdeltype::text FROM pg_constraint WHERE conrelid='slide_images'::regclass`;
    expect(constraints.map((row) => row.conname)).toEqual(
      expect.arrayContaining([
        "slide_images_pkey",
        "slide_images_slide_church_uk",
        "slide_images_media_type_valid",
        "slide_images_byte_size_valid",
        "slide_images_dimensions_valid",
        "slide_images_checksum_valid",
        "slide_images_slide_church_fk",
      ]),
    );
    expect(
      constraints.find(
        ({ conname }) => conname === "slide_images_slide_church_fk",
      )?.confdeltype,
    ).toBe("c");
    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN ('slides_image_total_ck', 'slide_images_total_ck')`;
    expect(triggers.map(({ tgname }) => tgname).sort()).toEqual([
      "slide_images_total_ck",
      "slides_image_total_ck",
    ]);
  });

  it("rejects a Slide whose selected content type and image child disagree", async () => {
    const owner = await church();
    await expect(
      prisma.slide.create({
        data: {
          churchId: owner.id,
          title: "Missing image child",
          body: null,
          contentType: "IMAGE",
        },
      }),
    ).rejects.toThrow();

    const text = await prisma.slide.create({
      data: { ...fields, churchId: owner.id },
    });
    await expect(
      prisma.$executeRaw`
        INSERT INTO slide_images(slide_id,church_id,media_type,byte_size,width,height,checksum,data)
        VALUES (${text.id}::uuid,${owner.id}::uuid,'image/png',1,1,1,${"0".repeat(64)},decode('00','hex'))`,
    ).rejects.toThrow();
  });

  it("physically deletes one slide without deleting siblings, its owner or other tenants", async () => {
    const [owner, other] = await Promise.all([church(), church()]);
    const create = (churchId: string) =>
      prisma.slide.create({ data: { ...fields, churchId } });
    const [target, sibling, foreign] = await Promise.all([
      create(owner.id),
      create(owner.id),
      create(other.id),
    ]);
    await prisma.slide.delete({ where: { id: target.id } });
    await expect(
      prisma.slide.findUnique({ where: { id: target.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.slide.count({ where: { id: { in: [sibling.id, foreign.id] } } }),
    ).resolves.toBe(2);
    await expect(
      prisma.church.findUnique({ where: { id: owner.id } }),
    ).resolves.not.toBeNull();
  });

  it("retains church content after user deletion and restores cascades on rollback", async () => {
    const owner = await church();
    const user = await prisma.user.create({
      data: {
        name: "Synthetic member",
        email: `${namespace}${randomUUID()}@example.invalid`,
        churchMembership: { create: { churchId: owner.id } },
      },
    });
    const row = await prisma.slide.create({
      data: { ...fields, churchId: owner.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await expect(
      prisma.slide.findUnique({ where: { id: row.id } }),
    ).resolves.not.toBeNull();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.church.delete({ where: { id: owner.id } });
        expect(await tx.slide.count({ where: { churchId: owner.id } })).toBe(0);
        throw new Error("synthetic rollback");
      }),
    ).rejects.toThrow("synthetic rollback");
    await expect(
      prisma.slide.findUnique({ where: { id: row.id } }),
    ).resolves.not.toBeNull();
  });

  it("leaves no orphan when creation races with church deletion", async () => {
    const owner = await church();
    const [deletion, creation] = await Promise.allSettled([
      prisma.church.delete({ where: { id: owner.id } }),
      prisma.slide.create({ data: { ...fields, churchId: owner.id } }),
    ]);
    expect(deletion.status).toBe("fulfilled");
    // Either the insert commits before the cascade or the FK rejects it.
    if (creation.status === "rejected") {
      expect(creation.reason).toMatchObject({ code: "P2003" });
    }
    await expect(
      prisma.slide.count({ where: { churchId: owner.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.church.findUnique({ where: { id: owner.id } }),
    ).resolves.toBeNull();
  });
});
