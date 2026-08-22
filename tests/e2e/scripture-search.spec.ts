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

  const legacyFormStyle = await page
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
  expect(legacyFormStyle).toMatchObject({
    columns: 4,
    fontSize: "11px",
    rows: 22,
  });
  expect(legacyFormStyle.fontFamily).toContain("Helvetica");

  const firstRow = page.locator(".ginmaku-books-table tr").first();
  await expect(firstRow.locator("td").nth(0)).toContainText("創世記/Genesis");

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
  await page.getByLabel("終了節（省略可）").fill("2");

  await page.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("新しいフォルダー名").fill("主日礼拝");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toBeVisible();
  const worshipFolder = page.getByRole("button", {
    name: "主日礼拝",
    exact: true,
  });
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "true");
  await worshipFolder.click();
  await expect(worshipFolder).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toHaveCount(0);
  await worshipFolder.click();
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toBeVisible();
  await page.getByLabel("ブックマーク名").fill("創世記 1:1–2");
  await page.getByRole("button", { name: "現在の聖書箇所を保存" }).click();
  await expect(
    page.getByRole("button", { name: "創世記 1:1–2", exact: true }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "出エジプト記/Exodus" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill("1");
  await page.getByLabel("終了節（省略可）").fill("1");
  await page.getByLabel("ブックマーク名").fill("出エジプト記 1:1");
  await page.getByRole("button", { name: "現在の聖書箇所を保存" }).click();
  const bookmarkRows = page.locator("[data-bookmark-id]");
  await bookmarkRows.nth(1).dragTo(bookmarkRows.nth(0));
  await expect(page.getByRole("status")).toContainText(
    "ブックマークの順序を変更しました。",
  );
  const bookmarks = page.locator(".bookmark-list");
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "出エジプト記 1:1",
  );
  await page.getByRole("button", { name: "創世記 1:1–2を上へ" }).click();
  await expect(bookmarks.getByRole("listitem").first()).toContainText(
    "創世記 1:1–2",
  );

  await page.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("新しいフォルダー名").fill("祈祷会");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "祈祷会" })).toBeVisible();
  await page.getByRole("button", { name: "よく使うフォルダーに固定" }).click();
  await expect(
    page.getByRole("button", { name: "固定：祈祷会" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "祈祷会を上へ" }).click();
  await expect(page.getByRole("status")).toContainText(
    "フォルダーの順序を変更しました。",
  );

  await page.getByRole("button", { name: "新規フォルダ作成" }).click();
  await page.getByLabel("新しいフォルダー名").fill("青年会");
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "青年会" })).toBeVisible();

  const folders = page.locator(".folder-list > li");
  await expect(folders.first()).toContainText("祈祷会");
  await page.getByRole("button", { name: "主日礼拝", exact: true }).click();
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toBeVisible();
  await expect(folders.nth(1)).toContainText("主日礼拝");
  await expect(folders.nth(2)).toContainText("青年会");

  await page.getByLabel("フォルダー名", { exact: true }).fill("礼拝用");
  await page.getByRole("button", { name: "名前を変更" }).click();
  await expect(
    page.getByRole("button", { name: "礼拝用", exact: true }),
  ).toBeVisible();

  const bookmarkOpened = context.waitForEvent("page");
  await page.getByRole("button", { name: "創世記 1:1–2", exact: true }).click();
  const bookmarkedAudience = await bookmarkOpened;
  await expect(page).toHaveURL(/\/scripture$/);
  await expect(bookmarkedAudience).toHaveURL(
    /\/scripture\/audience\?book=GEN&chapter=1&endVerse=2&language=both&startVerse=1$/,
  );
  await expect(
    bookmarkedAudience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();
  await bookmarkedAudience.close();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "創世記 1:1–2を削除" }).click();
  await expect(
    page.getByRole("button", { name: "創世記 1:1–2", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "出エジプト記 1:1", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "フォルダーを削除" }).click();
  await expect(
    page.getByRole("button", { name: "礼拝用", exact: true }),
  ).toHaveCount(0);
}
