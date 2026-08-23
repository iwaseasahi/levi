import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./scripture-fixture";
import {
  expectScriptureCatalog,
  loginToScripture,
  openGenesisAudience,
} from "./scripture-helpers";

test("validates the Ginmaku search form and projects each language mode", async ({
  context,
  page,
  scriptureAccount,
}) => {
  test.setTimeout(60_000);
  await loginToScripture(context, page, scriptureAccount);
  await expectScriptureCatalog(page);

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
        rows: element.querySelectorAll("tr").length,
      };
    });
  expect(searchLayout).toMatchObject({
    columns: 3,
    fontSize: "11px",
    rows: 22,
  });
  expect(searchLayout.fontFamily).toContain("Helvetica");
  await expect(
    page.locator(".ginmaku-books-table tr").first().locator("td").nth(0),
  ).toContainText("創世記/Genesis");

  const openButton = page.getByRole("button", { name: "Open", exact: true });
  const resetButton = page.getByRole("button", { name: "Reset", exact: true });
  const projectionPanel = page.locator(".projection-control-panel");
  await expect(openButton).toBeEnabled();
  await expect(openButton).toHaveCSS("background-color", "rgb(210, 165, 104)");
  await expect(openButton).toHaveCSS("color", "rgb(23, 17, 10)");
  await expect(openButton).toHaveCSS("border-radius", "8px");
  await expect(resetButton).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await expect(projectionPanel).toHaveCSS(
    "background-image",
    "linear-gradient(145deg, rgb(21, 21, 21), rgb(11, 11, 11))",
  );
  await expect(projectionPanel).toHaveCSS("border-radius", "12px");
  await expect(page.getByRole("group", { name: "投影操作" })).toBeVisible();

  await page.setViewportSize({ height: 683, width: 1365 });
  const viewportLayout = await page.evaluate(() => {
    const index = document
      .querySelector<HTMLElement>("#index_container")!
      .getBoundingClientRect();
    const bookChoices = Array.from(
      document.querySelectorAll<HTMLElement>(".ginmaku-book-choice"),
    );
    const trackedSelectors = [
      ".ginmaku-bookmark-container",
      ".ginmaku-books-table",
      ".scripture-search-console",
      ".projection-control-panel",
    ];
    const range = document
      .querySelector<HTMLElement>(".scripture-range-fields")!
      .getBoundingClientRect();
    const languages = document
      .querySelector<HTMLElement>(".scripture-language-options")!
      .getBoundingClientRect();
    const actions = document
      .querySelector<HTMLElement>(".scripture-search-actions")!
      .getBoundingClientRect();
    const rangeLabels = Array.from(
      document.querySelectorAll<HTMLElement>(".scripture-range-fields label"),
    );
    return {
      allBooksInsideViewport:
        bookChoices.length > 0 &&
        bookChoices.every((book) => {
          const bounds = book.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        }),
      documentHasVerticalScroll:
        document.documentElement.scrollHeight > window.innerHeight,
      ginmakuFixedWorkspace:
        index.left === 230 &&
        index.width === 940 &&
        window.innerWidth - index.right > 0,
      ginmakuToolbarOrder:
        range.top < languages.top &&
        languages.top < actions.top &&
        Math.abs(range.left - languages.left) < 1 &&
        Math.abs(languages.left - actions.left) < 1,
      rangeUnitsFollowInputs:
        rangeLabels.map((label) => label.textContent).join("|") ===
          "章(chapter)|節(verse)|節(verse)" &&
        rangeLabels.every((label) => {
          const input = label.querySelector("input")!.getBoundingClientRect();
          const unit = label.querySelector("span")!.getBoundingClientRect();
          return input.right <= unit.left;
        }),
      trackedControlsInsideViewport: trackedSelectors.every((selector) => {
        const bounds = document
          .querySelector(selector)!
          .getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
      }),
    };
  });
  expect(viewportLayout).toEqual({
    allBooksInsideViewport: true,
    documentHasVerticalScroll: false,
    ginmakuFixedWorkspace: true,
    ginmakuToolbarOrder: true,
    rangeUnitsFollowInputs: true,
    trackedControlsInsideViewport: true,
  });
  await expect(openButton).toBeInViewport();
  await expect(page.getByLabel("章")).toBeInViewport();

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
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  await page.getByLabel("章").fill("1");
  await openButton.click();
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

  const japaneseAudience = await openGenesisAudience(context, page, {
    language: "ja",
  });
  await expect(
    japaneseAudience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(
    japaneseAudience.getByText(
      "In the beginning God created the heavens and the earth.",
    ),
  ).toHaveCount(0);
  await japaneseAudience.close();

  const englishAudience = await openGenesisAudience(context, page, {
    language: "en",
  });
  await expect(
    englishAudience.getByText("初めに、神が天と地を創造した。"),
  ).toHaveCount(0);
  await expect(
    englishAudience.getByText(
      "In the beginning God created the heavens and the earth.",
    ),
  ).toBeVisible();
  await englishAudience.close();
});
