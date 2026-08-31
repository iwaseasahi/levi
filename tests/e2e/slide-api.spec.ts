import { randomUUID } from "node:crypto";
import type { SlideRecord } from "@/domain/slides/commands";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

test("Slide HTTP routes enforce session, Origin, revision and physical deletion", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  const headers = { Origin: "http://127.0.0.1:3100" };
  const input = {
    title: "Synthetic API slide",
    body: "First\n\n\n\nSecond",
    author: null,
  };
  const denied = await context.request.post("/api/church/slides", {
    headers: { Origin: "https://foreign.example" },
    data: input,
  });
  expect(denied.status()).toBe(403);
  const created = await context.request.post("/api/church/slides", {
    headers,
    data: input,
  });
  expect(created.status()).toBe(201);
  const { slide } = (await created.json()) as { slide: SlideRecord };
  expect(slide).toMatchObject({ ...input, revision: 1 });
  expect(created.headers()["cache-control"]).toBe("no-store");
  const path = `/api/church/slides/${slide.id}`;
  expect((await context.request.get(path)).status()).toBe(200);
  const updated = await context.request.put(path, {
    headers,
    data: { input: { ...input, title: "Edited" }, expectedRevision: 1 },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).slide.revision).toBe(2);
  expect(
    (
      await context.request.delete(path, {
        headers,
        data: { expectedRevision: 1 },
      })
    ).status(),
  ).toBe(409);

  const foreign = await prisma.church.create({
    data: { name: `test.e2e.slide-api.${randomUUID()}` },
  });
  try {
    const row = await prisma.slide.create({
      data: { ...input, churchId: foreign.id },
    });
    const result = await context.request.get(`/api/church/slides/${row.id}`);
    expect(result.status()).toBe(404);
    expect(await result.json()).toEqual({ error: { code: "SLIDE_NOT_FOUND" } });
  } finally {
    await prisma.church.delete({ where: { id: foreign.id } });
  }
  expect(
    (
      await context.request.delete(path, {
        headers,
        data: { expectedRevision: 2 },
      })
    ).status(),
  ).toBe(204);
  expect(await prisma.slide.findUnique({ where: { id: slide.id } })).toBeNull();
  await context.clearCookies();
  expect((await context.request.get(path)).status()).toBe(401);
});
