import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

test("Slide lifecycle keeps drafts private while saved content is listed, projected, edited and deleted", async ({
  context,
  page,
  scriptureAccount,
  pageErrorGuard,
}, testInfo) => {
  await loginToScripture(context, page, scriptureAccount);
  await page.goto("/slides");
  await expect(page.getByText("スライドはまだありません。")).toBeVisible();
  await page.getByRole("link", { name: "スライドを作成" }).click();
  const original = "礼拝 %_\\ ABC\n日本語の二行目\n\n\n\n二番目\n\n\n\n三番目";
  await page.getByLabel("本文").fill(original);
  await page.getByRole("button", { name: "保存前プレビュー" }).click();
  await expect(
    page.getByRole("region", { name: "本文プレビュー" }).locator("pre"),
  ).toHaveText(original);
  expect(context.pages()).toHaveLength(1);
  expect(
    await prisma.slide.count({
      where: { churchId: scriptureAccount.churchId },
    }),
  ).toBe(0);
  await page.getByLabel("タイトル").fill("Synthetic lifecycle");
  await expect(page.getByLabel(/著者/)).toHaveCount(0);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic lifecycle" }),
  ).toBeVisible();
  const detail = page.url();
  await page.goto("/slides");
  const results = page.getByRole("region", { name: "スライド一覧" });
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await results
    .getByRole("link", { name: "テキスト Synthetic lifecycle" })
    .click();
  const controller = page.getByRole("region", { name: "投影操作" });
  const opened = context.waitForEvent("page");
  await controller.getByRole("button", { name: "Open" }).click();
  const audience = await opened;
  await expect(audience.locator("pre")).toHaveText(original);
  await expect(controller.getByRole("status")).toContainText("投影中 · 100%");
  await expect(
    controller.getByRole("button", { name: "前のページへ投影" }),
  ).toHaveCount(0);
  await expect(
    controller.getByRole("button", { name: "次のページへ投影" }),
  ).toHaveCount(0);
  await expect(controller.getByLabel("投影ページ")).toHaveCount(0);
  await controller.getByRole("button", { name: "文字を大きく" }).click();
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.locator("pre")).toHaveText(original);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    (await new AxeBuilder({ page: audience }).analyze()).violations,
  ).toEqual([]);
  await audience.screenshot({
    path: testInfo.outputPath("slide-lifecycle-audience.png"),
  });

  const editor = await context.newPage();
  await editor.goto(`${detail}/edit`);
  const draft = "未保存の日本語\n第二行\n\n\n\n更新後の二番目";
  await editor.getByLabel("本文").fill(draft);
  await editor.getByLabel("本文").press("ArrowUp");
  await editor.getByRole("button", { name: "保存前プレビュー" }).click();
  await expect(
    editor.getByRole("region", { name: "本文プレビュー" }).locator("pre"),
  ).toHaveText(draft);
  await expect(audience.locator("pre")).toHaveText(original);
  expect(
    (
      await prisma.slide.findFirstOrThrow({
        where: { churchId: scriptureAccount.churchId },
      })
    ).body,
  ).toBe(original);
  await editor.getByLabel("タイトル").fill("Synthetic edited lifecycle");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    editor.getByRole("heading", { name: "Synthetic edited lifecycle" }),
  ).toBeVisible();
  // Visibility revalidation is valid even if the periodic check already cleared
  // the audience. Do not race a disabled navigation button after a saved edit.
  await audience.bringToFront();
  await audience.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(audience.getByRole("main").getByRole("alert")).toContainText(
    "更新されました",
  );
  await expect(audience.locator("pre")).toHaveCount(0);
  await controller
    .getByRole("button", { name: "最新の内容を読み込む" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Synthetic edited lifecycle" }),
  ).toBeVisible();
  await controller.getByRole("button", { name: "Open" }).click();
  await expect(audience.locator("pre")).toHaveText(draft);
  await expect(controller.getByRole("status")).toContainText("投影中 · 100%");
  await editor.getByRole("link", { name: "編集", exact: true }).click();
  editor.once("dialog", (dialog) => dialog.dismiss());
  await editor.getByRole("button", { name: "スライドを削除" }).click();
  await expect(
    editor.getByRole("button", { name: "スライドを削除" }),
  ).toBeFocused();
  pageErrorGuard.allowConsoleError(
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
  );
  editor.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Synthetic edited lifecycle");
    await dialog.accept();
  });
  await editor.getByRole("button", { name: "スライドを削除" }).click();
  await expect(editor).toHaveURL("/slides");
  await audience.bringToFront();
  await audience.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(audience.getByRole("main").getByRole("alert")).toContainText(
    "利用できません",
  );
  await expect(audience.locator("pre")).toHaveCount(0);
  expect(
    await prisma.slide.count({
      where: { churchId: scriptureAccount.churchId },
    }),
  ).toBe(0);
});

test("Slide list retries a failed read and concurrent editors retain unsaved input on conflict", async ({
  context,
  page,
  scriptureAccount,
  pageErrorGuard,
}) => {
  const slide = await prisma.slide.create({
    data: {
      churchId: scriptureAccount.churchId,
      title: "Synthetic conflict",
      body: "Original body",
    },
  });
  await loginToScripture(context, page, scriptureAccount);
  pageErrorGuard.allowConsoleError(
    "Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
  );
  await page.route("**/api/church/slides", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SLIDE_UNAVAILABLE" } }),
    }),
  );
  await page.goto("/slides");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  // StrictMode may start and discard an initial request; keep the simulated
  // outage active until the explicit user retry, not for an arbitrary count.
  await page.unroute("**/api/church/slides");
  await page.getByRole("button", { name: "再試行" }).click();
  await expect(
    page.getByRole("link", { name: `テキスト ${slide.title}` }),
  ).toBeVisible();
  await page.goto(`/slides/${slide.id}/edit`);
  const other = await context.newPage();
  await other.goto(`/slides/${slide.id}/edit`);
  await expect(page.getByLabel("タイトル")).toHaveValue(slide.title);
  await other.getByLabel("タイトル").fill("First saved editor");
  await other.getByRole("button", { name: "保存", exact: true }).click();
  await expect(other.getByText(/保存済み · リビジョン/)).toHaveCount(0);
  await page.getByLabel("タイトル").fill("Retained unsaved conflict");
  await page.getByLabel("本文").fill("Retained unsaved body");
  pageErrorGuard.allowConsoleError(
    "Failed to load resource: the server responded with a status of 409 (Conflict)",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toContainText("別の編集が保存されています");
  await expect(error).toBeFocused();
  await expect(page.getByLabel("タイトル")).toHaveValue(
    "Retained unsaved conflict",
  );
  await expect(page.getByLabel("本文")).toHaveValue("Retained unsaved body");
  expect(
    await prisma.slide.findUnique({ where: { id: slide.id } }),
  ).toMatchObject({
    title: "First saved editor",
    body: "Original body",
    revision: 2,
  });
});
