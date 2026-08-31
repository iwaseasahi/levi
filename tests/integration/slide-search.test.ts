import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import { createSlideSearchService } from "@/application/slides/search-slides";
import { prisma } from "@/infrastructure/database/client";
import { slideSearchRepository } from "@/infrastructure/database/slide-search-repository";

const prefix = "test.slide-search.";
const search = createSlideSearchService(slideSearchRepository);
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
describe("literal tenant search", () => {
  it("searches only body, folds only ASCII and treats SQL metacharacters literally", async () => {
    const owner = await scope();
    const bodies = [
      "ABC 日本語 É カナ",
      "abc 日本語 é ｶﾅ",
      "x%y",
      "x_y",
      "x\\y",
      "xy",
      " A\nB ",
    ];
    const rows = await Promise.all(
      bodies.map((body) =>
        prisma.slide.create({
          data: { ...owner, title: "title-only", author: "author-only", body },
        }),
      ),
    );
    for (const [q, indices] of [
      ["abc", [0, 1]],
      ["日本語", [0, 1]],
      ["É", [0]],
      ["é", [1]],
      ["カナ", [0]],
      ["ｶﾅ", [1]],
      ["%", [2]],
      ["_", [3]],
      ["\\", [4]],
      [" A\r\nB ", [6]],
      ["title-only", []],
      ["author-only", []],
      ["' OR true --", []],
    ] as const) {
      expect(
        (await search(owner, { q })).slides.map((row) => row.id).sort(),
      ).toEqual(indices.map((index) => rows[index]!.id).sort());
    }
    const all = await search(owner, {});
    expect(all.slides).toHaveLength(7);
    expect(all.slides[0]).not.toHaveProperty("body");
    expect(all.slides[0]).not.toHaveProperty("churchId");
  });
  it("traverses equal timestamps without duplicate/omission and isolates reused/tampered cursors", async () => {
    const [owner, foreign] = await Promise.all([scope(), scope()]);
    const date = new Date("2026-08-31T00:00:00Z");
    await prisma.slide.createMany({
      data: Array.from({ length: 45 }, (_, index) => ({
        ...owner,
        title: `Synthetic ${index}`,
        body: "match",
        createdAt: date,
      })),
    });
    const other = await prisma.slide.create({
      data: { ...foreign, title: "Foreign", body: "match", createdAt: date },
    });
    const ordered = await prisma.slide.findMany({
      where: owner,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    let page = await search(owner, { q: "match" });
    const ids: string[] = [];
    let cursor: string | null;
    do {
      ids.push(...page.slides.map((row) => row.id));
      cursor = page.nextCursor;
      if (cursor) page = await search(owner, { q: "match", cursor });
    } while (cursor);
    expect(ids).toEqual(ordered.map((row) => row.id));
    expect(page.slides).toHaveLength(5);
    const first = await search(owner, { q: "match" });
    await expect(
      search(owner, { q: "different", cursor: first.nextCursor }),
    ).rejects.toThrow();
    const reused = await search(foreign, {
      q: "match",
      cursor: first.nextCursor,
    });
    expect(reused.slides.every((row) => row.id === other.id)).toBe(true);
    const forged = JSON.stringify({
      ...JSON.parse(first.nextCursor!),
      churchId: foreign.churchId,
    });
    await expect(
      search(owner, { q: "match", cursor: forged }),
    ).rejects.toThrow();
  });
  it("caps recent at ten ordered by update/id, never writes recency, and reflects membership/deletes", async () => {
    const owner = await scope();
    const date = new Date("2026-08-30T00:00:00Z");
    await prisma.slide.createMany({
      data: Array.from({ length: 22 }, (_, index) => ({
        ...owner,
        title: `Synthetic ${index}`,
        body: "match",
        createdAt: date,
        updatedAt: date,
      })),
    });
    const expected = await prisma.slide.findMany({
      where: owner,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 10,
    });
    const recent = await search(owner, { mode: "recent" });
    expect(recent.slides.map((row) => row.id)).toEqual(
      expected.map((row) => row.id),
    );
    expect(recent.nextCursor).toBeNull();
    const first = await search(owner, { q: "match" });
    const next = await search(owner, { q: "match", cursor: first.nextCursor });
    await prisma.slide.update({
      where: { id: next.slides[0]!.id },
      data: { body: "changed", revision: { increment: 1 } },
    });
    await prisma.slide.delete({ where: { id: next.slides[1]!.id } });
    expect(
      (await search(owner, { q: "match", cursor: first.nextCursor })).slides,
    ).toEqual([]);
    expect((await search(owner, { mode: "recent" })).slides[0]!.id).toBe(
      next.slides[0]!.id,
    );
    expect(
      (await prisma.slide.findUniqueOrThrow({ where: { id: expected[0]!.id } }))
        .updatedAt,
    ).toEqual(date);
  });
});
