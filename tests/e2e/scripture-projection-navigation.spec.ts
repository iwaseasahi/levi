import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./scripture-fixture";
import { loginToScripture, openGenesisAudience } from "./scripture-helpers";

test("projects bilingual scripture and navigates across chapter and book boundaries", async ({
  context,
  page,
  scriptureAccount,
}) => {
  test.setTimeout(60_000);
  await loginToScripture(context, page, scriptureAccount);
  const displayedFontScale = page.getByRole("status", {
    name: "現在の文字サイズ",
  });
  await expect(displayedFontScale).toHaveText("100%");
  await page.getByRole("button", { name: "設定" }).click();
  await expect(
    page.getByRole("combobox", { name: "デフォルト文字サイズ" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "デフォルト設定" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "デフォルト設定" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ height: 720, width: 1280 });
  await page
    .getByRole("combobox", {
      name: "聖書投影のデフォルト文字サイズ",
    })
    .selectOption("1.4");
  await expect(page.getByRole("status")).toContainText("保存しました");
  await page.getByRole("link", { name: "聖書検索へ戻る" }).click();
  await expect(displayedFontScale).toHaveText("140%");
  await page.reload();
  await expect(displayedFontScale).toHaveText("140%");
  const audience = await openGenesisAudience(context, page, {
    endVerse: "",
    expectedEndVerse: "3",
    language: "both",
  });

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
  await expect(displayedFontScale).toHaveText("140%");
  for (let step = 0; step < 4; step += 1) await smaller.click();
  await expect(displayedFontScale).toHaveText("100%");

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

  await page.bringToFront();
  await page.getByLabel("章").focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:2",
    }),
  ).toBeVisible();
  await page.keyboard.press("ArrowUp");
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
  await expect(displayedFontScale).toHaveText("110%");
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
  await expect(displayedFontScale).toHaveText("100%");
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
  expect(
    (await new AxeBuilder({ page: audience }).analyze()).violations,
  ).toEqual([]);

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

  await audience.setViewportSize({ height: 360, width: 640 });
  await expect
    .poll(() =>
      audience.locator(".audience-screen").evaluate((screen) => {
        const heading = screen.querySelector<HTMLElement>(
          ".audience-book-name",
        );
        const verse = screen.querySelector<HTMLElement>(".audience-verse");
        if (!heading || !verse) return false;
        const availableHeight =
          screen.clientHeight - Math.max(26, heading.offsetHeight) * 2;
        return (
          verse.scrollHeight <= availableHeight + 1 &&
          verse.scrollWidth <= screen.clientWidth + 1 &&
          screen.scrollHeight <= screen.clientHeight + 1
        );
      }),
    )
    .toBe(true);
  const compactFitScale = await audience
    .locator(".audience-screen")
    .evaluate((element) =>
      Number(
        getComputedStyle(element)
          .getPropertyValue("--audience-fit-scale")
          .trim(),
      ),
    );

  await audience.setViewportSize({ height: 720, width: 1280 });
  await expect
    .poll(() =>
      audience
        .locator(".audience-screen")
        .evaluate(
          (element) => element.scrollHeight <= element.clientHeight + 1,
        ),
    )
    .toBe(true);
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
    .toBeGreaterThan(compactFitScale);
  await overflowStyle.evaluate((element) =>
    element.parentNode?.removeChild(element),
  );
  await audience.evaluate(() => window.dispatchEvent(new Event("resize")));
  await audience.close();
});
