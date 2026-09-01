import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

test("church member previews unsaved literal text, creates, edits and confirms deletion at narrow and wide widths", async ({
  context,
  page,
  scriptureAccount,
}, testInfo) => {
  await loginToScripture(context, page, scriptureAccount);
  const sidebar = page.locator("#bookmark_container");
  const slideListLink = sidebar.getByRole("link", {
    name: "スライドの一覧",
    exact: true,
  });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(slideListLink).toHaveAttribute("href", "/slides");
    await expect(
      sidebar.getByRole("link", { name: "スライドを作成" }),
    ).toHaveCount(0);
    await expect(
      sidebar.getByRole("region", { name: "スライド一覧" }),
    ).toHaveCount(0);
    const folderBox = await sidebar
      .getByRole("link", { name: "フォルダの一覧", exact: true })
      .boundingBox();
    const slideBox = await slideListLink.boundingBox();
    expect(slideBox!.y).toBeGreaterThanOrEqual(
      folderBox!.y + folderBox!.height,
    );
    expect(slideBox!.x).toBe(folderBox!.x);
    expect(slideBox!.width).toBe(folderBox!.width);
    expect(slideBox!.x + slideBox!.width).toBeLessThanOrEqual(width);
    await slideListLink.focus();
    await expect(slideListLink).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).include("#bookmark_container").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`slide-sidebar-link-${width}.png`),
      fullPage: true,
    });
  }
  await slideListLink.press("Enter");
  await expect(page).toHaveURL("/slides");
  const navigation = page.getByRole("navigation", {
    name: "主要ナビゲーション",
  });
  await expect(
    navigation.getByRole("link", { name: "聖書検索", exact: true }),
  ).toHaveAttribute("href", "/scripture");
  await expect(
    navigation.getByRole("link", { name: "スライド", exact: true }),
  ).toHaveAttribute("href", "/slides");
  await page.getByRole("link", { name: "スライドを作成" }).click();
  await expect(navigation).toBeVisible();
  await expect(sidebar).toBeVisible();
  const body =
    "<script>synthetic</script>\n日本語の本文\n\n\n\n" + "長い行".repeat(50);
  await page.getByLabel("本文").fill(body);
  await page.getByRole("button", { name: "保存前プレビュー" }).click();
  await expect(page.locator(".slide-text-frame pre")).toHaveText(body);
  await expect(page.getByRole("button", { name: "前のページ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "次のページ" })).toHaveCount(0);
  await expect(page.getByLabel("ページを選択")).toHaveCount(0);
  expect(
    await prisma.slide.count({
      where: { churchId: scriptureAccount.churchId },
    }),
  ).toBe(0);
  expect(context.pages()).toHaveLength(1);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.locator(".slide-text-frame").evaluate((frame) => {
          const outer = frame.getBoundingClientRect();
          const inner = frame.querySelector("pre")!.getBoundingClientRect();
          return (
            inner.left >= outer.left &&
            inner.right <= outer.right &&
            inner.top >= outer.top &&
            inner.bottom <= outer.bottom
          );
        }),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`slide-editor-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("タイトル").fill("Synthetic welcome");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic welcome" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await expect(sidebar).toBeVisible();
  await page.getByLabel("タイトル").fill("Synthetic edited welcome");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic edited welcome" }),
  ).toBeVisible();
  await expect(page.getByText(/保存済み · リビジョン/)).toHaveCount(0);
  await page.getByRole("link", { name: "編集", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "スライドを削除" }).click();
  await expect(
    page.getByRole("button", { name: "スライドを削除" }),
  ).toBeFocused();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "スライドを削除" }).click();
  await expect(page).toHaveURL("/slides");
  expect(
    await prisma.slide.count({
      where: { churchId: scriptureAccount.churchId },
    }),
  ).toBe(0);
});
