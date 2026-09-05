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
  const settings = page.getByRole("button", { name: "設定" });
  await expect(settings).toHaveCSS("position", "static");
  const settingsIconGeometry = await settings
    .locator("svg path")
    .evaluate((path) => {
      const bounds = (path as SVGGraphicsElement).getBBox();
      return {
        centerX: bounds.x + bounds.width / 2,
        centerY: bounds.y + bounds.height / 2,
      };
    });
  expect(settingsIconGeometry.centerX).toBeCloseTo(12, 2);
  expect(settingsIconGeometry.centerY).toBeCloseTo(12, 2);
  const settingsContainer = page.locator(".scripture-settings");
  await expect(settingsContainer).toHaveCSS("position", "fixed");
  const settingsBox = await settingsContainer.boundingBox();
  expect(1280 - (settingsBox!.x + settingsBox!.width)).toBe(12);
  expect(720 - (settingsBox!.y + settingsBox!.height)).toBe(12);
  await settings.click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".scripture-settings").analyze())
      .violations,
  ).toEqual([]);
  await settings.click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const captureCatalogLayout = () =>
    page.evaluate(() => {
      const books = document
        .querySelector<HTMLElement>(".ginmaku-books-table")!
        .getBoundingClientRect();
      const consoleBounds = document
        .querySelector<HTMLElement>(".scripture-search-console")!
        .getBoundingClientRect();
      const fieldset = document.querySelector<HTMLElement>(
        ".ginmaku-search-fields",
      )!;
      return {
        booksHeight: books.height,
        booksTop: books.top,
        consoleTop: consoleBounds.top,
        fieldsetOpacity: getComputedStyle(fieldset).opacity,
      };
    });
  const beforeBookSelection = await captureCatalogLayout();
  let releaseBookCatalog = () => {};
  const bookCatalogGate = new Promise<void>((resolve) => {
    releaseBookCatalog = resolve;
  });
  await page.route(
    (url) => url.pathname === "/api/scripture/catalog",
    async (route) => {
      await bookCatalogGate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  const loadingCatalog = page
    .locator(".search-feedback")
    .getByText("検索候補を読み込んでいます。", { exact: true });
  await expect(loadingCatalog).toHaveClass(/sr-only/);
  expect(
    await loadingCatalog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        clip: getComputedStyle(element).clip,
        height: bounds.height,
        width: bounds.width,
      };
    }),
  ).toEqual({ clip: "rect(0px, 0px, 0px, 0px)", height: 1, width: 1 });
  expect(await captureCatalogLayout()).toEqual(beforeBookSelection);
  releaseBookCatalog();
  await expect(loadingCatalog).toHaveCount(0);

  const beforeChapterInput = await captureCatalogLayout();
  let releaseChapterCatalog = () => {};
  const chapterCatalogGate = new Promise<void>((resolve) => {
    releaseChapterCatalog = resolve;
  });
  await page.route(
    (url) => url.pathname === "/api/scripture/catalog",
    async (route) => {
      await chapterCatalogGate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByLabel("章").fill("１");
  await expect(page.getByLabel("章")).toHaveValue("1");
  await expect(loadingCatalog).toHaveClass(/sr-only/);
  expect(await captureCatalogLayout()).toEqual(beforeChapterInput);
  releaseChapterCatalog();
  await expect(loadingCatalog).toHaveCount(0);
  expect(await captureCatalogLayout()).toEqual(beforeChapterInput);

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

  await page.getByLabel("開始節").fill("１");
  await page.getByLabel("終了節（省略可）").fill("２");
  await expect(page.getByLabel("開始節")).toHaveValue("1");
  await expect(page.getByLabel("終了節（省略可）")).toHaveValue("2");
  const normalizedAudienceOpened = context.waitForEvent("page");
  await openButton.click();
  const normalizedAudience = await normalizedAudienceOpened;
  await expect(normalizedAudience).toHaveURL(
    /\/scripture\/audience\?book=GEN&chapter=1&endVerse=2&language=both&startVerse=1#levi=[0-9a-f-]{36}$/,
  );
  await normalizedAudience.close();

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
