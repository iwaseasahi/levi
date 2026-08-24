import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./scripture-fixture";
import { loginToScripture, selectGenesis } from "./scripture-helpers";

test("creates, reorders, restores, edits, and deletes folders and bookmarks", async ({
  context,
  page,
  scriptureAccount,
}) => {
  test.setTimeout(60_000);
  await loginToScripture(context, page, scriptureAccount);
  await selectGenesis(page, { endVerse: "" });
  await expect(page.locator(".folder-sidebar-heading")).toHaveCount(0);

  const createFolderToggle = page.getByRole("button", {
    name: "新規フォルダ作成",
  });
  await expect(createFolderToggle).toHaveCSS("color", "rgb(241, 223, 197)");
  await expect(createFolderToggle).toHaveCSS(
    "background-color",
    "rgb(24, 20, 15)",
  );
  await createFolderToggle.click();
  const folderDate = page.getByLabel("日付");
  await expect(folderDate).toHaveAttribute("type", "date");
  await expect(folderDate).toHaveCSS("color-scheme", "dark");
  await folderDate.fill("2026-08-23");
  await expect(folderDate).toHaveValue("2026-08-23");
  await page.getByLabel("集会名").fill("第二礼拝");
  const createFolderButton = page.getByRole("button", {
    name: "作成",
    exact: true,
  });
  await expect(createFolderButton).toHaveCSS("color", "rgb(23, 17, 10)");
  await expect(createFolderButton).toHaveCSS(
    "background-color",
    "rgb(210, 165, 104)",
  );
  await createFolderButton.click();

  const worshipFolder = page.getByRole("button", {
    name: "2026-08-23 第二礼拝",
    exact: true,
  });
  await expect(worshipFolder).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "true");
  const worshipFolderName = worshipFolder.locator(".folder-name");
  await expect(worshipFolderName).toHaveCSS("white-space", "nowrap");
  await expect(worshipFolderName).toHaveCSS("text-overflow", "ellipsis");
  expect(
    await worshipFolderName.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect((await worshipFolder.boundingBox())!.height).toBeLessThanOrEqual(34);
  const folderEditLink = page.getByRole("link", {
    name: "2026-08-23 第二礼拝を編集",
  });
  expect((await folderEditLink.boundingBox())!.width).toBeLessThanOrEqual(30);
  await expect(folderEditLink).toHaveAttribute("href", /\/folders\/.+\/edit$/);
  await expect(folderEditLink).not.toHaveAttribute("target");
  await folderEditLink.focus();
  await expect(folderEditLink).toBeFocused();
  await expect(page.getByLabel("フォルダー名")).toHaveCount(0);
  await expect(page.getByText("ブックマーク名", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /を上へ/ })).toHaveCount(0);
  const folderListLink = page.getByRole("link", { name: "フォルダの一覧" });
  await expect(folderListLink).toHaveAttribute("href", "/folders");
  await expect(folderListLink).not.toHaveAttribute("target");
  await worshipFolder.click();
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "false");
  await worshipFolder.click();

  const favoriteButton = page.getByRole("button", {
    name: "お気に入りに追加",
  });
  await expect(
    page.getByText("フォルダーを選択してください。", { exact: true }),
  ).toHaveCount(0);
  const searchTableBox = await page
    .locator(".ginmaku-books-table")
    .boundingBox();
  const searchActionsBox = await page
    .locator(".scripture-search-actions")
    .boundingBox();
  const favoriteBox = await favoriteButton.boundingBox();
  expect(Math.abs(favoriteBox!.x - searchTableBox!.x)).toBeLessThan(2);
  expect(
    Math.abs(favoriteBox!.y - (searchActionsBox!.y + searchActionsBox!.height)),
  ).toBeLessThan(2);
  expect(favoriteBox!.y).toBeGreaterThanOrEqual(
    searchTableBox!.y + searchTableBox!.height,
  );
  await favoriteButton.click();
  const genesisBookmark = page.getByRole("link", {
    name: "創世記/Genesis 1:1",
    exact: true,
  });
  await expect(genesisBookmark).toBeVisible();
  await expect(genesisBookmark).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ginmaku-bookmark-container")
        .withRules(["color-contrast"])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.getByRole("radio", { name: "出エジプト記/Exodus" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill("1");
  await page.getByLabel("終了節（省略可）").fill("1");
  await favoriteButton.click();
  const bookmarkRows = page.locator("[data-bookmark-id]");
  await expect(bookmarkRows).toHaveCount(2);
  await expect(bookmarkRows.nth(0)).toHaveAttribute("draggable", "true");
  await expect(bookmarkRows.nth(1)).toHaveAttribute("draggable", "true");
  await bookmarkRows.nth(1).dragTo(bookmarkRows.nth(0));
  const bookmarks = page.locator(".bookmark-list");
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "出エジプト記/Exodus 1:1-1",
  );
  await bookmarks.getByRole("listitem").nth(1).press("Alt+ArrowUp");
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "創世記/Genesis 1:1",
  );

  await createFolderToggle.click();
  await page.getByLabel("集会名").fill("祈祷会");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "祈祷会", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".folder-toggle")).toHaveText([
    "▸2026-08-23 第二礼拝",
    "▾祈祷会",
  ]);
  await worshipFolder.click();
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".folder-toggle")).toHaveText([
    "▾2026-08-23 第二礼拝",
    "▸祈祷会",
  ]);
  await folderListLink.click();
  await expect(page).toHaveURL(/\/folders$/);
  await expect(
    page.getByRole("heading", { name: "フォルダの一覧" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".folder-management-page")
        .withRules(["color-contrast"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.getByRole("link", { name: "2026-08-23 第二礼拝を編集" }).click();
  await expect(page).toHaveURL(/\/folders\/[^/]+\/edit$/);
  await expect(page.getByLabel("よく使うフォルダーに固定")).toHaveCount(0);
  await page.getByLabel("フォルダー名").fill("礼拝用");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "フォルダーを更新しました。",
  );
  await expect(page.getByRole("link", { name: "編集" })).toHaveCount(0);
  await page.getByRole("link", { name: "フォルダの一覧へ" }).click();
  await expect(page).toHaveURL(/\/folders$/);
  await page.getByRole("link", { name: "聖書検索へ" }).click();
  await expect(page).toHaveURL(/\/scripture$/);
  const renamedFolder = page.getByRole("button", {
    name: "礼拝用",
    exact: true,
  });
  await expect(renamedFolder).toHaveAttribute("aria-expanded", "true");

  const pageCountBeforeBookmark = context.pages().length;
  await genesisBookmark.click();
  await expect(page).toHaveURL(/\/scripture$/);
  expect(context.pages()).toHaveLength(pageCountBeforeBookmark);
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeChecked();
  await expect(page.getByLabel("章")).toHaveValue("1");
  await expect(page.getByLabel("開始節")).toHaveValue("1");
  await expect(page.getByLabel("終了節（省略可）")).toHaveValue("");
  await expect(
    page.getByRole("radio", { name: "日本語 & English" }),
  ).toBeChecked();

  const bookmarkOpened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open" }).click();
  const bookmarkedAudience = await bookmarkOpened;
  await expect(bookmarkedAudience).toHaveURL(
    /\/scripture\/audience\?book=GEN&chapter=1&endVerse=3&language=both&startVerse=1$/,
  );
  await expect(
    bookmarkedAudience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();
  await bookmarkedAudience.close();

  await folderListLink.click();
  await page.getByRole("link", { name: "礼拝用を編集" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "削除", exact: true }).last().click();
  await expect(page.getByRole("status")).toHaveText(
    "お気に入りを削除しました。",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "フォルダーを削除" }).click();
  await expect(page).toHaveURL(/\/folders$/);
  await expect(page.getByRole("link", { name: "礼拝用を編集" })).toHaveCount(0);
});
