import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

test("Slide recent, all and literal body search traverse pages without exposing another church", async ({
  context,
  page,
  scriptureAccount,
}, testInfo) => {
  const date = new Date("2026-08-31T00:00:00Z");
  await prisma.slide.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      churchId: scriptureAccount.churchId,
      title: `Synthetic ${String(index).padStart(2, "0")}`,
      body: index === 0 ? "Literal %_\\ 日本語 ABC" : "Ordinary body",
      createdAt: date,
      updatedAt: date,
    })),
  });
  const foreign = await prisma.church.create({
    data: {
      name: `test.e2e.slide-search.${randomUUID()}`,
      slides: {
        create: { title: "Foreign synthetic", body: "Literal %_\\ 日本語 ABC" },
      },
    },
  });
  try {
    await loginToScripture(context, page, scriptureAccount);
    await page.goto("/slides");
    const list = page.getByRole("region", { name: "スライド一覧" });
    await expect(list.getByRole("listitem")).toHaveCount(10);
    await page.getByRole("button", { name: "すべて", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(20);
    const first = await list.getByRole("link").allTextContents();
    await page.getByRole("button", { name: "次の20件" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(5);
    const second = await list.getByRole("link").allTextContents();
    expect(new Set([...first, ...second]).size).toBe(25);
    await expect(page.getByRole("button", { name: "次の20件" })).toBeDisabled();
    await page.getByRole("button", { name: "前の20件" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(20);
    expect(await list.getByRole("link").allTextContents()).toEqual(first);
    await page.getByLabel("本文を検索").fill("%_\\ 日本語 abc");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(
      list.getByRole("link", { name: "Synthetic 00" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "前の20件" })).toBeDisabled();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`slide-search-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByLabel("本文を検索").fill("Synthetic 00");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(
      page.getByText("一致するスライドはありません。"),
    ).toBeVisible();
    await context.clearCookies();
    expect(
      (await context.request.get("/api/church/slides?q=ABC")).status(),
    ).toBe(401);
  } finally {
    await prisma.church.delete({ where: { id: foreign.id } });
  }
});
