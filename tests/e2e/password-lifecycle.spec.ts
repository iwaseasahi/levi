import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";
import {
  E2E_OPERATOR_EMAIL,
  E2E_PASSWORD,
  E2E_PASSWORD_USER_EMAIL,
} from "./operator-fixture";

test.use({ screenshot: "off", trace: "off", video: "off" });

test("operator reset revokes the old session and forces a new password", async ({
  browser,
  page,
}) => {
  const signIn = async (email: string, password: string) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
  };

  const staleContext = await browser.newContext();
  const stalePage = await staleContext.newPage();
  const staleSignIn = await stalePage.request.post("/api/auth/sign-in/email", {
    data: { email: E2E_PASSWORD_USER_EMAIL, password: E2E_PASSWORD },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(staleSignIn.ok()).toBe(true);
  await stalePage.goto("/church");
  await expect(
    stalePage.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeVisible();

  const operatorSignIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email: E2E_OPERATOR_EMAIL, password: E2E_PASSWORD },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(operatorSignIn.ok()).toBe(true);
  await page.goto("/admin/churches");
  await page
    .getByLabel("対象教会")
    .selectOption({ label: "test.e2e password church" });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "パスワードを再設定" }).click();
  await page.getByRole("button", { name: "一時パスワードを表示" }).click();
  const temporaryPassword = await page
    .locator(".notice-success code")
    .textContent();
  expect(temporaryPassword).toHaveLength(24);
  await page.getByRole("button", { name: "表示を閉じる" }).click();
  await stalePage.reload();
  await expect(stalePage).toHaveURL(/\/login$/);
  await staleContext.close();
  await page.request.post("/api/auth/sign-out", {
    headers: { origin: "http://127.0.0.1:3100" },
  });

  await signIn(E2E_PASSWORD_USER_EMAIL, temporaryPassword ?? "");
  await expect(page).toHaveURL(/\/change-password$/, { timeout: 20_000 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const selected = "z".repeat(16);
  await page.getByLabel("現在の一時パスワード").fill(temporaryPassword ?? "");
  await page.getByLabel("新しいパスワード", { exact: true }).fill(selected);
  await page.getByLabel("新しいパスワード（確認）").fill(selected);
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  await page.getByRole("button", { name: "教会用画面へ" }).click();
  await expect(page).toHaveURL(/\/church$/, { timeout: 20_000 });
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeVisible();
});
