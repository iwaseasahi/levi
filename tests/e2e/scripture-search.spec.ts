import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { E2E_CHURCH_USER_EMAIL, E2E_PASSWORD } from "./operator-fixture";

test("searches a valid bilingual range and hands it to projection", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(E2E_CHURCH_USER_EMAIL);
  await page.getByLabel("パスワード").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/church$/, { timeout: 20_000 });

  await page.getByLabel("書巻").selectOption({ label: "架空書" });
  await page.getByLabel("章").selectOption("1");
  await page.getByLabel("開始節").selectOption("1");
  await page.getByLabel("終了節").selectOption("2");
  await page.getByRole("button", { name: "御言葉を検索" }).click();

  await expect(page.getByText("架空の日本語本文 1")).toBeVisible();
  await expect(page.getByText("Synthetic English text 1")).toBeVisible();
  await expect(page.getByText("新改訳聖書第3版（JSS3）").first()).toBeVisible();
  await expect(
    page.getByText("New King James Version (NKJV)").first(),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "投影を開始" }).click();
  await expect(page).toHaveURL(
    /\/church\/projection\?book=TST&chapter=1&startVerse=1&endVerse=2&language=both$/,
  );
  await expect(
    page.getByRole("heading", { name: "投影の準備ができました" }),
  ).toBeVisible();
  expect(page.url()).not.toContain(encodeURIComponent("架空の日本語本文"));
});
