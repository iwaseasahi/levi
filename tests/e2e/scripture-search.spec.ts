import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  E2E_CHURCH_USER_EMAIL,
  E2E_FOREIGN_FOLDER_ID,
  E2E_PASSWORD,
} from "./operator-fixture";

const E2E_GUESSED_FOLDER_ID = "00000000-0000-4000-8000-000000004399";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(E2E_CHURCH_USER_EMAIL);
  await page.getByLabel("パスワード").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/scripture$/, { timeout: 20_000 });
}

async function searchGenesis(
  context: BrowserContext,
  page: Page,
  language: "ja" | "en" | "both",
  omitEnd = false,
) {
  const languageLabel = {
    both: "日本語 & English",
    en: "English Only",
    ja: "日本語のみ",
  }[language];
  await page.getByRole("radio", { name: languageLabel }).click();
  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill("1");
  await page.getByLabel("終了節（省略可）").fill(omitEnd ? "" : "2");
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const audience = await opened;
  await expect(page).toHaveURL(/\/scripture$/);
  await expect(audience).toHaveURL(
    new RegExp(
      `/scripture/audience\\?book=GEN&chapter=1&endVerse=${omitEnd ? "3" : "2"}&language=${language}&startVerse=1$`,
    ),
  );
  return audience;
}

test("opens scripture directly, navigates, recovers, and reuses bookmarks", async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);

  await expect(page.getByText("教会用画面", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ログアウト" })).toHaveCount(0);
  await expect(page.getByText("検索結果", { exact: true })).toHaveCount(0);
  await expect(page.locator(".ginmaku-search-page")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );

  for (const oldPath of [
    "/church",
    "/church/audience",
    "/church/projection",
    "/scripture/controller",
  ]) {
    const oldRoute = await page.request.get(oldPath, { maxRedirects: 0 });
    expect(oldRoute.status(), `${oldPath} must not redirect`).toBe(404);
  }

  const searchLayout = await page
    .locator(".ginmaku-books-table")
    .evaluate((element) => {
      const table = getComputedStyle(element);
      return {
        columns: element.querySelectorAll("tr:first-child td").length,
        fontFamily: table.fontFamily,
        fontSize: table.fontSize,
        rows: element.querySelectorAll("tr").length - 1,
      };
    });
  expect(searchLayout).toMatchObject({
    columns: 4,
    fontSize: "11px",
    rows: 22,
  });
  expect(searchLayout.fontFamily).toContain("Helvetica");

  const firstRow = page.locator(".ginmaku-books-table tr").first();
  await expect(firstRow.locator("td").nth(0)).toContainText("創世記/Genesis");
  await expect(
    page.getByRole("button", { name: "Open", exact: true }),
  ).toBeEnabled();

  const modernControls = await page.evaluate(() => {
    const open = getComputedStyle(
      document.querySelector<HTMLElement>(".search-action-primary")!,
    );
    const reset = getComputedStyle(
      document.querySelector<HTMLElement>(".search-action-secondary")!,
    );
    const projection = getComputedStyle(
      document.querySelector<HTMLElement>(".projection-control-panel")!,
    );
    return {
      openBackground: open.backgroundColor,
      openColor: open.color,
      openRadius: open.borderRadius,
      projectionBackground: projection.backgroundImage,
      projectionRadius: projection.borderRadius,
      resetBackground: reset.backgroundColor,
    };
  });
  expect(modernControls).toEqual({
    openBackground: "rgb(210, 165, 104)",
    openColor: "rgb(23, 17, 10)",
    openRadius: "8px",
    projectionBackground:
      "linear-gradient(145deg, rgb(21, 21, 21), rgb(11, 11, 11))",
    projectionRadius: "12px",
    resetBackground: "rgb(32, 32, 32)",
  });
  await expect(page.getByRole("group", { name: "投影操作" })).toBeVisible();

  await page.setViewportSize({ height: 720, width: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeVisible();
  await page.setViewportSize({ height: 720, width: 1280 });

  const searchAccessibility = await new AxeBuilder({ page }).analyze();
  expect(searchAccessibility.violations).toEqual([]);

  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  await page.getByLabel("章").fill("1");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const missingStartVerse = page.locator(".search-feedback").getByRole("alert");
  await expect(missingStartVerse).toHaveText("開始節を入力してください。");
  await expect(missingStartVerse).toBeFocused();
  expect(
    await missingStartVerse.evaluate((element) => {
      const message = element.querySelector("p")!;
      return {
        background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(message).color,
      };
    }),
  ).toEqual({
    background: "rgb(43, 16, 16)",
    color: "rgb(255, 180, 171)",
  });

  const foreignFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_FOREIGN_FOLDER_ID}`,
  );
  const guessedFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_GUESSED_FOLDER_ID}`,
  );
  expect(foreignFolder.status()).toBe(404);
  expect(guessedFolder.status()).toBe(404);
  expect(await foreignFolder.text()).toBe(await guessedFolder.text());

  let audience = await searchGenesis(context, page, "ja");
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(
    audience.getByText(
      "In the beginning God created the heavens and the earth.",
    ),
  ).toHaveCount(0);
  await audience.close();

  audience = await searchGenesis(context, page, "en");
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toHaveCount(0);
  await expect(
    audience.getByText(
      "In the beginning God created the heavens and the earth.",
    ),
  ).toBeVisible();
  await audience.close();

  audience = await searchGenesis(context, page, "both", true);

  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(
    audience.getByText(
      "In the beginning God created the heavens and the earth.",
    ),
  ).toBeVisible();
  expect(audience.url()).not.toContain(encodeURIComponent("初めに、神が"));
  await expect(page.getByRole("heading", { name: "投影操作" })).toHaveCount(0);
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();
  const projectedLines = audience.locator(".audience-book-word");
  await expect(projectedLines).toHaveCount(2);
  await expect(projectedLines.nth(0)).toHaveAttribute("lang", "ja");
  await expect(projectedLines.nth(0)).toContainText(
    "初めに、神が天と地を創造した。",
  );
  await expect(projectedLines.nth(1)).toHaveAttribute("lang", "en");
  await expect(projectedLines.nth(1)).toContainText(
    "In the beginning God created the heavens and the earth.",
  );
  await expect(audience.locator(".audience-translation")).toHaveCount(0);
  const ginmakuStyles = await audience.evaluate(() => {
    const screen = getComputedStyle(
      document.querySelector<HTMLElement>(".audience-screen")!,
    );
    const heading = getComputedStyle(
      document.querySelector<HTMLElement>(".audience-book-name")!,
    );
    const verseNumber = getComputedStyle(
      document.querySelector<HTMLElement>(".audience-verse-number")!,
    );
    const line = getComputedStyle(
      document.querySelector<HTMLElement>(".audience-book-word")!,
    );
    return {
      background: screen.backgroundColor,
      color: line.color,
      fontFamily: screen.fontFamily,
      headingColor: heading.color,
      textShadow: line.textShadow,
      verseColor: verseNumber.color,
      verseStyle: verseNumber.fontStyle,
    };
  });
  expect(ginmakuStyles).toEqual({
    background: "rgb(0, 0, 0)",
    color: "rgb(255, 255, 255)",
    fontFamily: "Helvetica, Arial, sans-serif",
    headingColor: "rgb(255, 255, 0)",
    textShadow:
      "rgb(0, 0, 255) -1px -1px 0px, rgb(0, 0, 255) 1px -1px 0px, rgb(0, 0, 255) -1px 1px 0px, rgb(0, 0, 255) 1px 1px 0px",
    verseColor: "rgb(255, 255, 0)",
    verseStyle: "italic",
  });
  await expect(audience.getByRole("button", { name: "次へ" })).toHaveCount(0);

  const larger = page.getByRole("button", { name: "文字を大きく" });
  const smaller = page.getByRole("button", { name: "文字を小さく" });
  const previous = page.getByRole("button", { name: "前の御言葉へ" });
  const next = page.getByRole("button", { name: "次の御言葉へ" });
  const toggleBlank = page.getByRole("button", {
    name: "空白と表示を切り替え",
  });
  await expect(larger).toBeEnabled();
  await expect(smaller).toBeEnabled();
  await expect(previous).toBeEnabled();
  await expect(next).toBeEnabled();
  await expect(toggleBlank).toBeEnabled();

  await toggleBlank.click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await expect(audience.locator(".audience-book-name")).toHaveCount(0);
  await expect(audience.locator(".audience-book-word")).toHaveCount(0);
  await next.click();
  await toggleBlank.click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:2",
    }),
  ).toBeVisible();
  await previous.click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();

  const initialFontSize = await audience
    .locator(".audience-content")
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
  await larger.click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-content")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
    )
    .toBeGreaterThan(initialFontSize);
  await smaller.click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-content")
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
    )
    .toBe(initialFontSize);

  await next.click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:2",
    }),
  ).toBeVisible();
  await previous.click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();

  const audienceAccessibility = await new AxeBuilder({
    page: audience,
  }).analyze();
  expect(audienceAccessibility.violations).toEqual([]);

  const audienceScrollTop = await audience
    .locator(".audience-screen")
    .evaluate((element) => element.scrollTop);
  await audience.keyboard.press("ArrowDown");
  await expect(audience.locator(".audience-verse-number").first()).toHaveText(
    "2:",
  );
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:2",
    }),
  ).toBeVisible();
  expect(
    await audience
      .locator(".audience-screen")
      .evaluate((element) => element.scrollTop),
  ).toBe(audienceScrollTop);
  await audience.keyboard.press("ArrowUp");
  await expect(audience.locator(".audience-verse-number").first()).toHaveText(
    "1:",
  );
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowDown");
  await expect(audience.locator(".audience-verse-number").first()).toHaveText(
    "2:",
  );
  await audience.keyboard.press("ArrowDown");
  await expect(audience.locator(".audience-verse-number").first()).toHaveText(
    "3:",
  );
  await audience.keyboard.press("ArrowDown");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 2:1",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowUp");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:3",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowDown");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 2:1",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowDown");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 2:2",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowDown");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 出エジプト記 1:1",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowUp");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 2:2",
    }),
  ).toBeVisible();

  const overflowStyle = await audience.addStyleTag({
    content: ".audience-book-word { font-size: 4em !important; }",
  });
  await audience.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect
    .poll(() =>
      audience
        .locator(".audience-screen")
        .evaluate((element) =>
          Number(
            getComputedStyle(element)
              .getPropertyValue("--audience-fit-scale")
              .trim(),
          ),
        ),
    )
    .toBeLessThan(1);
  const fittedVerse = await audience.locator(".audience-verse").boundingBox();
  expect(fittedVerse).not.toBeNull();
  expect(fittedVerse!.y).toBeGreaterThanOrEqual(0);
  expect(fittedVerse!.y + fittedVerse!.height).toBeLessThanOrEqual(720);
  await overflowStyle.evaluate((element) =>
    element.parentNode?.removeChild(element),
  );
  await audience.evaluate(() => window.dispatchEvent(new Event("resize")));

  await audience.reload();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();

  await audience.close();
  await expect(larger).toBeDisabled({ timeout: 3_000 });
  const audienceReopened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  audience = await audienceReopened;
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await audience.close();

  await organizeAndReopenBookmarks(context, page);
});

async function organizeAndReopenBookmarks(context: BrowserContext, page: Page) {
  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill("1");

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
  const searchTableBox = await page
    .locator(".ginmaku-books-table")
    .boundingBox();
  const favoriteBox = await favoriteButton.boundingBox();
  expect(Math.abs(favoriteBox!.x - searchTableBox!.x)).toBeLessThan(2);
  expect(favoriteBox!.y).toBeGreaterThanOrEqual(
    searchTableBox!.y + searchTableBox!.height,
  );
  await favoriteButton.click();
  await expect(
    page.getByRole("link", {
      name: "創世記/Genesis 1:1-3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "創世記/Genesis 1:1-3",
      exact: true,
    }),
  ).toHaveCSS("color", "rgb(255, 255, 255)");

  const savedContentAccessibility = await new AxeBuilder({ page })
    .include(".ginmaku-bookmark-container")
    .withRules(["color-contrast"])
    .analyze();
  expect(savedContentAccessibility.violations).toEqual([]);

  await page.getByRole("radio", { name: "出エジプト記/Exodus" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill("1");
  await page.getByLabel("終了節（省略可）").fill("1");
  await favoriteButton.click();
  const bookmarkRows = page.locator("[data-bookmark-id]");
  await bookmarkRows.nth(1).dragTo(bookmarkRows.nth(0));
  const bookmarks = page.locator(".bookmark-list");
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "出エジプト記/Exodus 1:1-1",
  );
  await bookmarks.getByRole("listitem").nth(1).press("Alt+ArrowUp");
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "創世記/Genesis 1:1-3",
  );

  await page.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("集会名").fill("祈祷会");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "祈祷会", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await worshipFolder.click();
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "true");
  await folderListLink.click();
  const folderEditor = page;
  await expect(page).toHaveURL(/\/folders$/);
  await expect(
    page.getByRole("heading", { name: "フォルダの一覧" }),
  ).toBeVisible();
  const folderListAccessibility = await new AxeBuilder({ page })
    .include(".folder-management-page")
    .withRules(["color-contrast"])
    .analyze();
  expect(folderListAccessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("link", { name: "2026-08-23 第二礼拝を編集" }).click();
  await expect(page).toHaveURL(/\/folders\/[^/]+\/edit$/);
  await folderEditor.getByLabel("フォルダー名").fill("礼拝用");
  await folderEditor.getByLabel("よく使うフォルダーに固定").check();
  await folderEditor.getByRole("button", { name: "変更を保存" }).click();
  await expect(folderEditor.getByRole("status")).toHaveText(
    "フォルダーを更新しました。",
  );
  await expect(folderEditor.getByRole("link", { name: "編集" })).toHaveCount(0);
  await folderEditor.getByRole("link", { name: "フォルダの一覧へ" }).click();
  await expect(page).toHaveURL(/\/folders$/);
  await page.getByRole("link", { name: "御言葉の検索へ" }).click();
  await expect(page).toHaveURL(/\/scripture$/);
  const renamedFolder = page.getByRole("button", {
    name: "礼拝用",
    exact: true,
  });
  await expect(renamedFolder).toHaveAttribute("aria-expanded", "true");

  const bookmarkOpened = context.waitForEvent("page");
  await page
    .getByRole("link", { name: "創世記/Genesis 1:1-3", exact: true })
    .click();
  const bookmarkedAudience = await bookmarkOpened;
  await expect(page).toHaveURL(/\/scripture$/);
  await expect(bookmarkedAudience).toHaveURL(
    /\/scripture\/audience\?book=GEN&chapter=1&endVerse=3&language=both&startVerse=1$/,
  );
  await expect(
    bookmarkedAudience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();
  await bookmarkedAudience.close();

  await page.getByRole("link", { name: "フォルダの一覧" }).click();
  await page.getByRole("link", { name: "礼拝用を編集" }).click();
  folderEditor.once("dialog", (dialog) => dialog.accept());
  await folderEditor
    .getByRole("button", { name: "削除", exact: true })
    .last()
    .click();
  await expect(folderEditor.getByRole("status")).toHaveText(
    "お気に入りを削除しました。",
  );
  folderEditor.once("dialog", (dialog) => dialog.accept());
  await folderEditor.getByRole("button", { name: "フォルダーを削除" }).click();
  await expect(page).toHaveURL(/\/folders$/);
  await expect(page.getByRole("link", { name: "礼拝用を編集" })).toHaveCount(0);
}
