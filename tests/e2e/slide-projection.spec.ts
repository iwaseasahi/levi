import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@/infrastructure/database/client";
import { expect, test } from "./scripture-fixture";
import { loginToScripture, selectGenesis } from "./scripture-helpers";

test("saved slides project the complete body, acknowledge controls, reauthorize and reuse scripture projector", async ({
  context,
  page,
  scriptureAccount,
  pageErrorGuard,
}, testInfo) => {
  const slide = await prisma.slide.create({
    data: {
      churchId: scriptureAccount.churchId,
      title: "Synthetic projection title",
      author: "Synthetic author",
      body:
        "<script>synthetic</script>\n日本語の本文\n\n\n\n" +
        "長い行".repeat(50) +
        "\n\n\n\nFinal",
    },
  });
  await loginToScripture(context, page, scriptureAccount);
  await page.goto(`/slides/${slide.id}`);
  const controller = page.getByRole("region", { name: "投影操作" });
  const opened = context.waitForEvent("page");
  await controller.getByRole("button", { name: "Open" }).click();
  const audience = await opened;
  await expect(audience.locator("pre")).toHaveText(slide.body);
  await expect(audience.getByRole("navigation")).toHaveCount(0);
  await expect(audience.getByText(slide.title)).toHaveCount(0);
  await expect(audience.getByText(slide.author!)).toHaveCount(0);
  expect(audience.url()).not.toContain("synthetic");
  await expect(
    controller.getByRole("button", { name: "前のページへ投影" }),
  ).toHaveCount(0);
  await expect(
    controller.getByRole("button", { name: "次のページへ投影" }),
  ).toHaveCount(0);
  await expect(controller.getByLabel("投影ページ")).toHaveCount(0);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`slide-controller-${width}.png`),
      fullPage: true,
    });
  }
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await audience.setViewportSize({ width: width!, height: height! });
    await expect
      .poll(() =>
        audience.locator(".slide-text-frame").evaluate((frame) => {
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
      (await new AxeBuilder({ page: audience }).analyze()).violations,
    ).toEqual([]);
    await audience.screenshot({
      path: testInfo.outputPath(`slide-audience-${width}.png`),
    });
  }
  await controller.getByRole("button", { name: "文字を大きく" }).click();
  await expect(controller.getByRole("status")).toContainText("110%");
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.locator("pre")).toHaveText(slide.body);
  await audience.reload();
  await expect(audience.locator("pre")).toHaveText(slide.body);
  await expect(controller.getByRole("status")).toContainText("100%");

  await prisma.slide.update({
    where: { id: slide.id },
    data: { body: "Updated synthetic body", revision: { increment: 1 } },
  });
  await audience.bringToFront();
  await audience.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(audience.getByRole("main").getByRole("alert")).toContainText(
    "更新されました",
  );
  await expect(audience.locator("pre")).toHaveCount(0);
  await page.reload();
  await controller.getByRole("button", { name: "Open" }).click();
  await expect(audience.locator("pre")).toHaveText("Updated synthetic body");
  expect(context.pages()).toHaveLength(2);

  await page.goto("/scripture");
  await selectGenesis(page);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    audience.getByRole("heading", { name: "新改訳聖書第3版 創世記 1:1" }),
  ).toBeVisible();
  await page.goto(`/slides/${slide.id}`);
  await controller.getByRole("button", { name: "Open" }).click();
  await expect(audience.locator("pre")).toHaveText("Updated synthetic body");
  expect(context.pages()).toHaveLength(2);
  pageErrorGuard.allowConsoleError(
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
  );
  await prisma.slide.delete({ where: { id: slide.id } });
  await audience.bringToFront();
  await audience.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(audience.getByRole("main").getByRole("alert")).toContainText(
    "利用できません",
  );
  await expect(audience.locator("pre")).toHaveCount(0);
});

test("invalid Slide coordinates recover through Open and a closed audience can reopen", async ({
  context,
  page,
  scriptureAccount,
}) => {
  const slide = await prisma.slide.create({
    data: {
      churchId: scriptureAccount.churchId,
      title: "Synthetic coordinate recovery",
      body: "First\n\n\n\nSecond",
    },
  });
  await loginToScripture(context, page, scriptureAccount);
  await page.goto(`/slides/${slide.id}`);
  const controller = page.getByRole("region", { name: "投影操作" });
  const opened = context.waitForEvent("page");
  await controller.getByRole("button", { name: "Open" }).click();
  let audience = await opened;
  await expect(audience.locator("pre")).toHaveText(slide.body);
  const valid = new URL(audience.url());
  for (const value of ["-1", "2", "invalid"]) {
    const invalid = new URL(valid);
    invalid.searchParams.set("page", value);
    await audience.goto(invalid.href);
    await expect(audience.getByRole("main").getByRole("alert")).toContainText(
      "スライドを表示できません",
    );
    await expect(audience.locator("pre")).toHaveCount(0);
    await expect(audience.getByRole("navigation")).toHaveCount(0);
    await controller.getByRole("button", { name: "Open" }).click();
    await expect(audience.locator("pre")).toHaveText(slide.body);
  }
  await expect(
    controller.getByRole("button", { name: "文字を大きく" }),
  ).toBeEnabled();
  await audience.close();
  await expect(
    controller.getByRole("button", { name: "文字を大きく" }),
  ).toBeDisabled();
  const reopened = context.waitForEvent("page");
  await controller.getByRole("button", { name: "Open" }).click();
  audience = await reopened;
  await expect(audience.locator("pre")).toHaveText(slide.body);
  await expect(
    controller.getByRole("button", { name: "文字を大きく" }),
  ).toBeEnabled();
});
