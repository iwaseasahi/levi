import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture, selectGenesis } from "./scripture-helpers";

test("Slide list shows clear tenant-scoped rows and cursor pagination", async ({
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
      body: "Ordinary body",
      createdAt: index === 24 ? new Date(date.getTime() + 1000) : date,
      updatedAt: date,
    })),
  });
  const foreign = await prisma.church.create({
    data: {
      name: `test.e2e.slide-list.${randomUUID()}`,
      slides: {
        create: { title: "Foreign synthetic", body: "Foreign body" },
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
    await expect(page.getByText(/著者：/)).toHaveCount(0);
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
    await list
      .getByRole("link", { name: longTitle, exact: true })
      .press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(longTitle);
    const detailSidebar = page.getByRole("complementary", {
      name: "サイドバー",
    });
    await expect(detailSidebar).toBeVisible();
    await expect(
      detailSidebar.getByRole("link", {
        name: "フォルダの一覧",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      detailSidebar.getByRole("link", {
        name: "スライドの一覧",
        exact: true,
      }),
    ).toBeVisible();
    await context.clearCookies();
    expect((await context.request.get("/api/church/slides")).status()).toBe(
      401,
    );
  } finally {
    await prisma.church.delete({ where: { id: foreign.id } });
  }
});

test("Slide sidebar shares folders and restores a Scripture bookmark in the same tab", async ({
  context,
  page,
  scriptureAccount,
}) => {
  const savedSlide = await prisma.slide.create({
    data: {
      churchId: scriptureAccount.churchId,
      title: "Synthetic favorite slide",
      body: "Synthetic favorite body",
    },
  });
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
  ).toBeEnabled();
  await page.getByRole("button", { name: "お気に入りに追加" }).click();
  await expect(
    sidebar.getByRole("link", {
      name: "Synthetic favorite slide",
      exact: true,
    }),
  ).toHaveAttribute("href", `/slides/${savedSlide.id}`);
  await sidebar.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("集会名").fill("Synthetic second folder");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    sidebar.getByRole("button", {
      name: "Synthetic second folder",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("region", { name: "スライド一覧" })
    .getByRole("link", { name: "Synthetic favorite slide", exact: true })
    .click();
  await expect(page.getByText(/保存済み · リビジョン/)).toHaveCount(0);
  const blank = page.getByRole("button", {
    name: "空白と表示を切り替え",
  });
  const favorite = page.getByRole("button", { name: "お気に入りに追加" });
  await expect(favorite).toBeEnabled();
  await expect(blank.locator("xpath=following-sibling::*[1]")).toHaveText(
    "お気に入りに追加",
  );
  await favorite.click();
  await expect
    .poll(() =>
      prisma.slideBookmark.count({
        where: {
          bookmark: { folder: { name: "Synthetic second folder" } },
          slideId: savedSlide.id,
        },
      }),
    )
    .toBe(1);
  await expect(
    sidebar.getByRole("link", {
      name: "Synthetic favorite slide",
      exact: true,
    }),
  ).toHaveAttribute("href", `/slides/${savedSlide.id}`);
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
  await page
    .getByRole("button", { name: "Synthetic sidebar folder", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Synthetic favorite slide", exact: true })
    .click();
  await expect(page).toHaveURL(`/slides/${savedSlide.id}`);
  await expect(
    page.getByRole("heading", { name: "Synthetic favorite slide" }),
  ).toBeVisible();
});
