import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import { createSlideService } from "@/application/slides/manage-slides";
import { createSlideHandlers } from "@/app/api/church/slides/controller";
import { prisma } from "@/infrastructure/database/client";
import { slideRepository } from "@/infrastructure/database/slide-repository";

const prefix = "test.slide-crud.";
const input = { title: "Synthetic", body: "Synthetic body" };
const service = createSlideService(slideRepository);
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

describe("scoped Slide persistence", () => {
  it("normalizes create/read/update, increments only revision and physically deletes", async () => {
    const owner = await scope();
    const created = await service.create(owner, {
      title: " Synthetic ",
      body: "A\r\nB",
    });
    expect(created).toMatchObject({
      title: "Synthetic",
      body: "A\nB",
      revision: 1,
    });
    expect(created).not.toHaveProperty("churchId");
    expect(await service.get(owner, created.id)).toEqual(created);
    const updated = await service.update(owner, created.id, {
      expectedRevision: 1,
      input,
    });
    expect(updated).toMatchObject({
      ...input,
      revision: 2,
      createdAt: created.createdAt,
    });
    await service.delete(owner, created.id, { expectedRevision: 2 });
    expect(
      await prisma.slide.findUnique({ where: { id: created.id } }),
    ).toBeNull();
    expect(
      await prisma.church.findUnique({ where: { id: owner.churchId } }),
    ).not.toBeNull();
  });

  it("makes foreign and missing read/update/delete UUIDs identical and preserves the foreign row", async () => {
    const [owner, other] = await Promise.all([scope(), scope()]);
    const foreign = await service.create(other, input);
    const handlers = createSlideHandlers({
      repository: slideRepository,
      origin: "https://levi.example",
      getChurchAccess: async () => ({
        status: "authorized",
        scope: owner,
        userId: "synthetic",
        mustChangePassword: false,
      }),
    });
    for (const action of ["read", "update", "delete"] as const) {
      const results = [];
      for (const id of [foreign.id, randomUUID()]) {
        const request = new Request("https://levi.example/api/church/slides", {
          method:
            action === "read" ? "GET" : action === "update" ? "PUT" : "DELETE",
          headers: {
            origin: "https://levi.example",
            "content-type": "application/json",
          },
          ...(action !== "read"
            ? {
                body: JSON.stringify(
                  action === "update"
                    ? { input, expectedRevision: 1 }
                    : { expectedRevision: 1 },
                ),
              }
            : {}),
        });
        const response = await handlers[action](request, id);
        results.push({
          status: response.status,
          body: await response.text(),
          cache: response.headers.get("cache-control"),
        });
      }
      expect(results[0]).toEqual(results[1]);
      expect(results[0]).toMatchObject({
        status: 404,
        body: '{"error":{"code":"SLIDE_NOT_FOUND"}}',
        cache: "no-store",
      });
    }
    expect(await service.get(other, foreign.id)).toEqual(foreign);
  });

  it("rejects stale update/delete and allows exactly one concurrent revision writer", async () => {
    const owner = await scope();
    const created = await service.create(owner, input);
    const results = await Promise.allSettled(
      ["First", "Second"].map((title) =>
        service.update(owner, created.id, {
          input: { ...input, title },
          expectedRevision: 1,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "SLIDE_CONFLICT" });
    expect((await service.get(owner, created.id)).revision).toBe(2);
    await expect(
      service.delete(owner, created.id, { expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: "SLIDE_CONFLICT" });
    const race = await Promise.allSettled([
      service.update(owner, created.id, { input, expectedRevision: 2 }),
      service.delete(owner, created.id, { expectedRevision: 2 }),
    ]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const row = await slideRepository.find(owner, created.id);
    expect(row === null || row.revision === 3).toBe(true);
  });

  it("rolls back invalid persistence and handles revision exhaustion without losing the row", async () => {
    const owner = await scope();
    const row = await service.create(owner, input);
    await expect(
      slideRepository.update(owner, row.id, 1, {
        ...input,
        body: "invalid\rbody",
      }),
    ).rejects.toThrow();
    expect(await service.get(owner, row.id)).toEqual(row);
    await prisma.slide.update({
      where: { id: row.id },
      data: { revision: 2_147_483_647 },
    });
    await expect(
      service.update(owner, row.id, { input, expectedRevision: 2_147_483_647 }),
    ).rejects.toMatchObject({ code: "SLIDE_CONFLICT" });
    await service.delete(owner, row.id, { expectedRevision: 2_147_483_647 });
    expect(await slideRepository.find(owner, row.id)).toBeNull();
  });
});
