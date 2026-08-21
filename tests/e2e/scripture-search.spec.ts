import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
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
  await expect(page).toHaveURL(/\/church$/, { timeout: 20_000 });
}

async function searchGenesis(page: Page, language: "ja" | "en" | "both") {
  await page.getByLabel("表示言語").selectOption(language);
  await page
    .getByLabel("書巻")
    .selectOption({ label: language === "en" ? "Genesis" : "創世記" });
  await page.getByLabel("章").selectOption("1");
  await page.getByLabel("開始節").selectOption("1");
  await page.getByLabel("終了節").selectOption("2");
  await page.getByRole("button", { name: "御言葉を検索" }).click();
  await expect(page.getByRole("heading", { name: "検索結果" })).toBeFocused();
}

test("completes search, projection, recovery, and bookmark reuse", async ({
  context,
  page,
}) => {
  test.setTimeout(60_000);
  await login(page);

  const foreignFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_FOREIGN_FOLDER_ID}`,
  );
  const guessedFolder = await page.request.get(
    `/api/saved-content?folderId=${E2E_GUESSED_FOLDER_ID}`,
  );
  expect(foreignFolder.status()).toBe(404);
  expect(guessedFolder.status()).toBe(404);
  expect(await foreignFolder.text()).toBe(await guessedFolder.text());

  await searchGenesis(page, "ja");
  await expect(page.getByText("初めに、神が天と地を創造した。")).toBeVisible();
  await expect(
    page.getByText("In the beginning God created the heavens and the earth."),
  ).toHaveCount(0);

  await searchGenesis(page, "en");
  await expect(page.getByText("初めに、神が天と地を創造した。")).toHaveCount(0);
  await expect(
    page.getByText("In the beginning God created the heavens and the earth."),
  ).toBeVisible();

  await searchGenesis(page, "both");

  await expect(page.getByText("初めに、神が天と地を創造した。")).toBeVisible();
  await expect(
    page.getByText("In the beginning God created the heavens and the earth."),
  ).toBeVisible();
  await expect(page.getByText("新改訳聖書第3版（JSS3）").first()).toBeVisible();
  await expect(
    page.getByText("New King James Version (NKJV)").first(),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "投影を開始" }).click();
  await expect(page).toHaveURL(
    /\/church\/projection\?book=GEN&chapter=1&startVerse=1&endVerse=2&language=both$/,
  );
  await expect(page.getByRole("heading", { name: "投影操作" })).toBeVisible();
  expect(page.url()).not.toContain(encodeURIComponent("初めに、神が"));

  const audienceOpened = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "会衆向け画面を新しいタブで開く" })
    .click();
  let audience = await audienceOpened;
  await expect(page.getByRole("status")).toContainText("接続しています");
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 / Genesis : 1:1",
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
  await expect(audience.locator(".controller-actions")).toHaveCount(0);
  await expect(audience.getByRole("button", { name: "次へ" })).toHaveCount(0);

  const controllerAccessibility = await new AxeBuilder({ page }).analyze();
  expect(controllerAccessibility.violations).toEqual([]);
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
      name: "新改訳聖書第3版 創世記 / Genesis : 1:2",
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
      name: "新改訳聖書第3版 創世記 / Genesis : 1:1",
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
      name: "新改訳聖書第3版 創世記 / Genesis : 2:1",
    }),
  ).toBeVisible();
  await audience.keyboard.press("ArrowUp");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 / Genesis : 1:3",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(audience.locator(".audience-verse-number").first()).toHaveText(
    "2:",
  );
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 出エジプト記 / Exodus : 1:1",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "前へ" }).click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 / Genesis : 2:2",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "創世記 1:1" }).click();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 / Genesis : 1:1",
    }),
  ).toBeVisible();

  const initialFontSize = await audience
    .locator(".audience-content")
    .evaluate((element) => getComputedStyle(element).fontSize);
  await page.getByRole("button", { name: "文字を大きく" }).click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-content")
        .evaluate((element) => getComputedStyle(element).fontSize),
    )
    .not.toBe(initialFontSize);
  await page.getByRole("button", { name: "文字を小さく" }).click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-content")
        .evaluate((element) => getComputedStyle(element).fontSize),
    )
    .toBe(initialFontSize);

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

  await audience.addStyleTag({
    content: ".audience-content { min-height: 300vh !important; }",
  });
  await page.getByRole("button", { name: "下へスクロール" }).click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-screen")
        .evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(0);
  const scrolledDown = await audience
    .locator(".audience-screen")
    .evaluate((element) => element.scrollTop);
  await page.getByRole("button", { name: "上へスクロール" }).click();
  await expect
    .poll(() =>
      audience
        .locator(".audience-screen")
        .evaluate((element) => element.scrollTop),
    )
    .toBeLessThan(scrolledDown);

  await page.getByRole("button", { name: "画面を暗転" }).click();
  await expect(audience.getByLabel("暗転中")).toBeVisible();
  await expect(page.getByText("会衆向け画面：暗転中")).toBeVisible();
  await page.getByRole("button", { name: "投影を再開" }).click();
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();

  await audience.reload();
  await expect(page.getByRole("status")).toContainText("接続しています");
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await audience.evaluate(() =>
    window.postMessage(
      { schema: "levi.projection", type: "CLEAR", version: 99 },
      window.location.origin,
    ),
  );
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();

  await audience.close();
  await expect(page.getByRole("status")).toContainText("閉じています", {
    timeout: 5_000,
  });
  const audienceReopened = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "会衆向け画面を新しいタブで開く" })
    .click();
  audience = await audienceReopened;
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await audience.close();

  await page.goto("/church");
  await organizeAndReopenBookmarks(page);
});

async function organizeAndReopenBookmarks(page: Page) {
  await page.getByLabel("書巻").selectOption({ label: "創世記" });
  await page.getByLabel("章").selectOption("1");
  await page.getByLabel("開始節").selectOption("1");
  await page.getByLabel("終了節").selectOption("2");
  await page.getByRole("button", { name: "御言葉を検索" }).click();
  await expect(page.getByText("初めに、神が天と地を創造した。")).toBeVisible();

  await page.getByLabel("新しいフォルダー名").fill("主日礼拝");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toBeVisible();
  await page.getByLabel("ブックマーク名").fill("創世記 1:1–2");
  await page.getByRole("button", { name: "現在の検索結果を保存" }).click();
  await expect(
    page.getByRole("button", { name: "創世記 1:1–2", exact: true }),
  ).toBeVisible();

  await page.getByLabel("書巻").selectOption({ label: "出エジプト記" });
  await page.getByLabel("章").selectOption("1");
  await page.getByLabel("開始節").selectOption("1");
  await page.getByLabel("終了節").selectOption("1");
  await page.getByRole("button", { name: "御言葉を検索" }).click();
  await page.getByLabel("ブックマーク名").fill("出エジプト記 1:1");
  await page.getByRole("button", { name: "現在の検索結果を保存" }).click();
  await page.getByRole("button", { name: "出エジプト記 1:1を上へ" }).click();
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

  await page.getByLabel("新しいフォルダー名").fill("祈祷会");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("heading", { name: "祈祷会" })).toBeVisible();
  await page.getByRole("button", { name: "よく使うフォルダーに固定" }).click();
  await expect(
    page.getByRole("button", { name: "固定：祈祷会" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "祈祷会を上へ" }).click();
  await expect(page.getByRole("status")).toContainText(
    "フォルダーの順序を変更しました。",
  );

  await page.getByLabel("新しいフォルダー名").fill("青年会");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByRole("heading", { name: "青年会" })).toBeVisible();

  const folders = page.getByRole("list", { name: "フォルダー" });
  await expect(folders.getByRole("listitem").first()).toContainText("祈祷会");
  await page.getByRole("button", { name: "主日礼拝", exact: true }).click();
  await expect(page.getByRole("heading", { name: "主日礼拝" })).toBeVisible();
  await expect(folders.getByRole("listitem").nth(1)).toContainText("主日礼拝");
  await expect(folders.getByRole("listitem").nth(2)).toContainText("青年会");

  await page.getByLabel("フォルダー名", { exact: true }).fill("礼拝用");
  await page.getByRole("button", { name: "名前を変更" }).click();
  await expect(
    page.getByRole("button", { name: "礼拝用", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "創世記 1:1–2", exact: true }).click();
  await expect(page.getByLabel("書巻")).toHaveValue("GEN");
  await expect(page.getByLabel("終了節")).toHaveValue("2");
  await expect(page.getByText("初めに、神が天と地を創造した。")).toBeVisible();

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
