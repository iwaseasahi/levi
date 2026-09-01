import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import { createSlideListService } from "@/application/slides/list-slides";
import { prisma } from "@/infrastructure/database/client";
import { slideListRepository } from "@/infrastructure/database/slide-list-repository";

const prefix = "test.slide-list.";
const list = createSlideListService(slideListRepository);
async function scope() {
  const church = await prisma.church.create({
    data: { name: `${prefix}${randomUUID()}` },
  });
  return { churchId: church.id } as ChurchScope;
}
afterEach(() =>
  prisma.church.deleteMany({ where: { name: { startsWith: prefix } } }),
);
afterAll(() => prisma.$disconnect());

describe("tenant Slide list", () => {
  it("traverses equal timestamps without duplicate or omission and omits protected fields", async () => {
    const [owner, foreign] = await Promise.all([scope(), scope()]);
    const date = new Date("2026-08-31T00:00:00Z");
    await prisma.slide.createMany({
      data: Array.from({ length: 45 }, (_, index) => ({
        ...owner,
        title: `Synthetic ${index}`,
        body: `Protected ${index}`,
        createdAt: date,
      })),
    });
    const foreignSlide = await prisma.slide.create({
      data: {
        ...foreign,
        title: "Foreign",
        body: "Protected",
        createdAt: date,
      },
    });
    const ordered = await prisma.slide.findMany({
      where: owner,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    let page = await list(owner, {});
    const ids: string[] = [];
    let cursor: string | null;
    do {
      ids.push(...page.slides.map((row) => row.id));
      expect(page.slides.every((row) => !("body" in row))).toBe(true);
      expect(page.slides.every((row) => !("churchId" in row))).toBe(true);
      cursor = page.nextCursor;
      if (cursor) page = await list(owner, { cursor });
    } while (cursor);
    expect(ids).toEqual(ordered.map((row) => row.id));
    expect(page.slides).toHaveLength(5);

    const first = await list(owner, {});
    const reused = await list(foreign, { cursor: first.nextCursor });
    expect(reused.slides.every((row) => row.id === foreignSlide.id)).toBe(true);
    expect(reused.slides.some((row) => ids.includes(row.id))).toBe(false);
    const forged = JSON.stringify({
      ...JSON.parse(first.nextCursor!),
      churchId: foreign.churchId,
    });
    await expect(list(owner, { cursor: forged })).rejects.toThrow();
  });

  it("uses a live creation-order list after edits and deletes", async () => {
    const owner = await scope();
    const date = new Date("2026-08-30T00:00:00Z");
    await prisma.slide.createMany({
      data: Array.from({ length: 22 }, (_, index) => ({
        ...owner,
        title: `Synthetic ${index}`,
        body: "Body",
        createdAt: date,
        updatedAt: date,
      })),
    });
    const first = await list(owner, {});
    const next = await list(owner, { cursor: first.nextCursor });
    await prisma.slide.update({
      where: { id: next.slides[0]!.id },
      data: { body: "Changed", revision: { increment: 1 } },
    });
    await prisma.slide.delete({ where: { id: next.slides[1]!.id } });
    const refreshed = await list(owner, { cursor: first.nextCursor });
    expect(refreshed.slides.map((row) => row.id)).toEqual([next.slides[0]!.id]);
    expect(
      (
        await prisma.slide.findUniqueOrThrow({
          where: { id: next.slides[0]!.id },
        })
      ).updatedAt,
    ).not.toEqual(date);
  });
});
