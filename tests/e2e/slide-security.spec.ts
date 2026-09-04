import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

const headers = { Origin: "http://127.0.0.1:3100" };
const input = { title: "Synthetic audit", body: "Synthetic audit body" };

test("Slide routes reject foreign identity, forged scope and reused cursors without metadata disclosure", async ({
  context,
  page,
  scriptureAccount,
  pageErrorGuard,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  const foreign = await prisma.church.create({
    data: { name: `test.e2e.slide-security.${randomUUID()}` },
  });
  try {
    const row = await prisma.slide.create({
      data: {
        ...input,
        churchId: foreign.id,
        title: "Synthetic foreign title",
      },
    });
    const missing = randomUUID();
    for (const method of ["GET", "PUT", "DELETE"]) {
      const responses = [];
      for (const id of [row.id, missing]) {
        const response = await context.request.fetch(
          `/api/church/slides/${id}`,
          {
            method,
            headers,
            ...(method === "GET"
              ? {}
              : {
                  data:
                    method === "PUT"
                      ? { input, expectedRevision: 1 }
                      : { expectedRevision: 1 },
                }),
          },
        );
        responses.push({
          status: response.status(),
          cache: response.headers()["cache-control"],
          body: await response.text(),
        });
      }
      expect(responses[0]).toEqual(responses[1]);
      expect(responses[0]).toEqual({
        status: 404,
        cache: "no-store",
        body: '{"error":{"code":"SLIDE_NOT_FOUND"}}',
      });
    }
    expect(
      (
        await context.request.post("/api/church/slides", {
          headers,
          data: { ...input, churchId: foreign.id },
        })
      ).status(),
    ).toBe(400);
    const listResponse = await context.request.get("/api/church/slides");
    expect(listResponse.status()).toBe(200);
    expect(listResponse.headers()["cache-control"]).toBe("no-store");
    expect(await listResponse.json()).toEqual({ slides: [], nextCursor: null });
    for (const query of ["?mode=all", "?mode=recent", "?q=Synthetic"])
      expect(
        (await context.request.get(`/api/church/slides${query}`)).status(),
      ).toBe(400);
    const cursor = JSON.stringify({
      version: 1,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    });
    const response = await context.request.get(
      `/api/church/slides?${new URLSearchParams({ cursor })}`,
    );
    expect(await response.json()).toEqual({ slides: [], nextCursor: null });
    const forged = JSON.stringify({
      ...JSON.parse(cursor),
      churchId: foreign.id,
    });
    expect(
      (
        await context.request.get(
          `/api/church/slides?${new URLSearchParams({ cursor: forged })}`,
        )
      ).status(),
    ).toBe(400);
    pageErrorGuard.allowConsoleError(
      "Failed to load resource: the server responded with a status of 404 (Not Found)",
    );
    for (const path of [
      `/slides/${row.id}`,
      `/slides/${row.id}/edit`,
      `/slides/audience?id=${row.id}`,
      `/slides/audience?id=${missing}`,
    ]) {
      const result = await page.goto(path);
      // The canonical browser suite runs next dev, whose page shell is
      // no-cache/must-revalidate. Protected Slide API payloads above are no-store.
      expect(result?.headers()["cache-control"]).toContain("no-cache");
      const shell = await result!.text();
      for (const value of [row.title, row.body])
        expect(shell).not.toContain(value);
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(page.getByText(row.title, { exact: true })).toHaveCount(0);
      await expect(page.getByText(row.body!, { exact: true })).toHaveCount(0);
    }
    expect(await prisma.slide.findUnique({ where: { id: row.id } })).toEqual(
      row,
    );
  } finally {
    await prisma.church.delete({ where: { id: foreign.id } });
  }
});

for (const denied of ["revoked", "suspended"] as const) {
  test(`Slide audience clears on ${denied} session and cannot restore content by keys or reload`, async ({
    context,
    page,
    scriptureAccount,
    pageErrorGuard,
  }) => {
    const slide = await prisma.slide.create({
      data: {
        ...input,
        body: "Synthetic protected page\n\n\n\nSecond",
        churchId: scriptureAccount.churchId,
      },
    });
    await loginToScripture(context, page, scriptureAccount);
    await page.goto(`/slides/${slide.id}`);
    const controller = page.getByRole("region", { name: "投影操作" });
    const opened = context.waitForEvent("page");
    await controller.getByRole("button", { name: "Open" }).click();
    const audience = await opened;
    await expect(audience.locator("pre")).toHaveText(slide.body!);
    pageErrorGuard.allowConsoleError(
      denied === "revoked"
        ? "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
        : "Failed to load resource: the server responded with a status of 403 (Forbidden)",
    );
    if (denied === "revoked")
      await prisma.session.deleteMany({
        where: { userId: scriptureAccount.userId },
      });
    else
      await prisma.church.update({
        where: { id: scriptureAccount.churchId },
        data: { status: "SUSPENDED", suspendedAt: new Date() },
      });
    await audience.bringToFront();
    await audience.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await expect(audience.getByRole("main").getByRole("alert")).toContainText(
      "利用できません",
    );
    await expect(audience.locator("pre")).toHaveCount(0);
    await audience.keyboard.press("ArrowDown");
    await audience.reload();
    await expect(audience.getByRole("main").getByRole("alert")).toContainText(
      "利用できません",
    );
    await expect(audience.locator("pre")).toHaveCount(0);
    await expect(audience.getByRole("textbox")).toHaveCount(0);
    await expect(audience.getByRole("navigation")).toHaveCount(0);
  });
}
