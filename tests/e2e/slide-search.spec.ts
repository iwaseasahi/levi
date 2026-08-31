import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import type { SlideSearchResult } from "@/domain/slides/search";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture, selectGenesis } from "./scripture-helpers";

test("Slide list shows clear rows and pagination while search/recent APIs retain tenant isolation", async ({
  context,
  page,
  scriptureAccount,
}, testInfo) => {
  const date = new Date("2026-08-31T00:00:00Z");
  const longTitle = "長いスライドタイトル".repeat(15);
  await prisma.slide.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      churchId: scriptureAccount.churchId,
      title:
        index === 24
          ? longTitle
          : `Synthetic ${String(index).padStart(2, "0")}`,
      author: index === 24 ? "Synthetic author" : null,
      body: index === 0 ? "Literal %_\\ 日本語 ABC" : "Ordinary body",
      createdAt: index === 24 ? new Date(date.getTime() + 1000) : date,
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
    await expect(page).toHaveTitle("スライドの一覧");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "スライドの一覧",
    );
    await expect(page.getByRole("button", { name: "最近の更新" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "すべて", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("本文を検索")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "一覧を更新" })).toHaveCount(
      0,
    );
    const list = page.getByRole("region", { name: "スライド一覧" });
    await expect(list.getByRole("listitem")).toHaveCount(20);
    await expect(list.getByRole("link").first()).toHaveAccessibleName(
      longTitle,
    );
    const first = await list
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    await expect(list.getByText("Foreign synthetic")).toHaveCount(0);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const sidebarBox = await page
        .getByRole("complementary", { name: "サイドバー" })
        .boundingBox();
      const mainBox = await page.getByRole("main").boundingBox();
      if (width === 1280) {
        expect(sidebarBox!.x + sidebarBox!.width).toBeLessThan(mainBox!.x);
      } else {
        expect(sidebarBox!.y + sidebarBox!.height).toBeLessThanOrEqual(
          mainBox!.y,
        );
      }
      const link = list.getByRole("link", { name: longTitle, exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`slide-list-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "次の20件" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(5);
    const second = await list
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(new Set([...first, ...second]).size).toBe(25);
    await expect(page.getByRole("button", { name: "次の20件" })).toBeDisabled();
    await page.getByRole("button", { name: "前の20件" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(20);
    expect(
      await list
        .getByRole("link")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
    ).toEqual(first);
    // The simplified UI no longer exposes these controls; the API contract remains.
    const recentResponse = await context.request.get(
      "/api/church/slides?mode=recent",
    );
    expect(recentResponse.status()).toBe(200);
    const recent = (await recentResponse.json()) as SlideSearchResult;
    expect(recent.slides).toHaveLength(10);
    expect(
      recent.slides.some((slide) => slide.title === "Foreign synthetic"),
    ).toBe(false);
    const query = new URLSearchParams({ q: "%_\\ 日本語 abc" });
    const searchResponse = await context.request.get(
      `/api/church/slides?${query}`,
    );
    expect(searchResponse.status()).toBe(200);
    const matches = (await searchResponse.json()) as SlideSearchResult;
    expect(matches.slides.map((slide) => slide.title)).toEqual([
      "Synthetic 00",
    ]);
    const titleResponse = await context.request.get(
      "/api/church/slides?q=Synthetic+00",
    );
    expect(titleResponse.status()).toBe(200);
    expect(((await titleResponse.json()) as SlideSearchResult).slides).toEqual(
      [],
    );
    await list
      .getByRole("link", { name: longTitle, exact: true })
      .press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(longTitle);
    await expect(
      page.getByRole("complementary", { name: "サイドバー" }),
    ).toHaveCount(0);
    await context.clearCookies();
    expect(
      (await context.request.get("/api/church/slides?q=ABC")).status(),
    ).toBe(401);
  } finally {
    await prisma.church.delete({ where: { id: foreign.id } });
  }
});

test("Slide sidebar shares folders and restores a Scripture bookmark in the same tab", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  await page.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("集会名").fill("Synthetic sidebar folder");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await selectGenesis(page, { endVerse: "" });
  await page.getByRole("button", { name: "お気に入りに追加" }).click();
  await expect(
    page.getByRole("link", { name: "創世記/Genesis 1:1", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "スライドの一覧", exact: true }).click();
  await expect(page).toHaveURL(/\/slides$/);
  const sidebar = page.getByRole("complementary", { name: "サイドバー" });
  await expect(sidebar).toBeVisible();
  const folder = sidebar.getByRole("button", {
    name: "Synthetic sidebar folder",
    exact: true,
  });
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(
    sidebar.getByRole("link", { name: "フォルダの一覧", exact: true }),
  ).toHaveAttribute("href", "/folders");
  await expect(
    sidebar.getByRole("link", { name: "スライドの一覧", exact: true }),
  ).toHaveAttribute("href", "/slides");
  await expect(
    page.getByRole("button", { name: "お気に入りに追加" }),
  ).toHaveCount(0);
  await sidebar.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("集会名").fill("Synthetic second folder");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    sidebar.getByRole("button", {
      name: "Synthetic second folder",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await folder.click();
  const pagesBefore = context.pages().length;
  const bookmark = sidebar.getByRole("link", {
    name: "創世記/Genesis 1:1",
    exact: true,
  });
  await bookmark.focus();
  await bookmark.press("Enter");
  await expect(page).toHaveURL(
    /\/scripture\?book=GEN&chapter=1&startVerse=1&language=both$/,
  );
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeChecked();
  await expect(page.getByLabel("章")).toHaveValue("1");
  await expect(page.getByLabel("開始節")).toHaveValue("1");
  await expect(page.getByLabel("終了節（省略可）")).toHaveValue("");
  await expect(
    page.getByRole("radio", { name: "日本語 & English" }),
  ).toBeChecked();
  expect(context.pages()).toHaveLength(pagesBefore);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("章")).toHaveValue("");
});
