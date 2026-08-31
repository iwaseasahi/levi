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
  const sidebar = page.getByRole("region", { name: "サイドバーのスライド" });
  await expect(sidebar.getByText("スライドはまだありません。")).toBeVisible();
  await page.getByRole("link", { name: "スライドを作成" }).click();
  const body =
    "<script>synthetic</script>\n日本語の本文\n\n\n\n" + "長い行".repeat(50);
  await page.getByLabel("本文（必須）").fill(body);
  await page.getByRole("button", { name: "保存前プレビュー" }).click();
  await expect(page.locator(".slide-text-frame pre")).toHaveText(
    "<script>synthetic</script>\n日本語の本文",
  );
  expect(
    await prisma.slide.count({
      where: { churchId: scriptureAccount.churchId },
    }),
  ).toBe(0);
  expect(context.pages()).toHaveLength(1);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "次のページ" }).click();
    await expect(
      page.getByRole("button", { name: "次のページ" }),
    ).toBeDisabled();
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
    await page.getByRole("button", { name: "前のページ" }).click();
  }
  await page.getByLabel("タイトル（必須）").fill("Synthetic welcome");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic welcome" }),
  ).toBeVisible();
  await page.goto("/scripture");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const slideLink = sidebar.getByRole("link", {
      name: "Synthetic welcome",
      exact: true,
    });
    await expect(slideLink).toBeVisible();
    await slideLink.focus();
    await expect(slideLink).toBeFocused();
    const folders = page.getByRole("region", {
      name: "フォルダーとお気に入り",
    });
    const folderBox = await folders.boundingBox();
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox!.y).toBeGreaterThanOrEqual(
      folderBox!.y + folderBox!.height,
    );
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(width);
    expect(
      (await new AxeBuilder({ page }).include("#bookmark_container").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`slide-sidebar-${width}.png`),
      fullPage: true,
    });
  }
  await sidebar
    .getByRole("link", { name: "Synthetic welcome", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Synthetic welcome" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "編集", exact: true }).click();
  await page.getByLabel("タイトル（必須）").fill("Synthetic edited welcome");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic edited welcome" }),
  ).toBeVisible();
  await expect(page.getByText("保存済み · リビジョン 2")).toBeVisible();
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
