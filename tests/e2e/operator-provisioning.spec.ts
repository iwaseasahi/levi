import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  E2E_CHURCH_USER_EMAIL,
  E2E_CREATED_CHURCH,
  E2E_CREATED_EMAIL,
  E2E_OPERATOR_EMAIL,
  E2E_PASSWORD,
} from "./operator-fixture";

// A successful Server Action response contains a live one-time credential.
// Keep this file out of screenshots, traces, and videos so it cannot enter CI
// artifacts, even when a later assertion fails.
test.use({ screenshot: "off", trace: "off", video: "off" });

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: E2E_PASSWORD },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(response.ok()).toBe(true);
}

test.describe("operator administration access", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/admin/churches");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "ログイン" }),
    ).toBeVisible();
    await expect(page.locator(".auth-card")).toHaveCSS(
      "background-color",
      "rgb(16, 16, 16)",
    );
    await expect(page.getByLabel("メールアドレス")).toHaveCSS(
      "background-color",
      "rgb(36, 36, 36)",
    );
  });

  test("returns not found to an authenticated church user", async ({
    page,
  }) => {
    await signIn(page, E2E_CHURCH_USER_EMAIL);

    const response = await page.request.get("/admin/churches");

    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("教会アカウントを作成");
  });
});

test.describe("operator church provisioning", () => {
  test.describe.configure({ mode: "serial" });

  test("provisions an account through first login and password change", async ({
    page,
  }) => {
    await signIn(page, E2E_OPERATOR_EMAIL);
    await page.goto("/admin/churches");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "教会アカウントを作成",
      }),
    ).toBeVisible();
    await expect(page.locator(".admin-form").first()).toHaveCSS(
      "background-color",
      "rgb(16, 16, 16)",
    );
    await expect(page.getByLabel("教会名")).toHaveCSS(
      "background-color",
      "rgb(36, 36, 36)",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByLabel("教会名").fill(E2E_CREATED_CHURCH);
    await page.getByLabel("利用者名").fill("Synthetic Created User");
    await page.getByLabel("ログイン用メールアドレス").fill(E2E_CREATED_EMAIL);
    await page
      .getByRole("button", { name: "教会と初期アカウントを作成" })
      .click();

    const success = page.getByRole("status").filter({
      hasText: "教会と初期アカウントを作成しました。",
    });
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await page.getByRole("button", { name: "一時パスワードを表示" }).click();
    const temporaryPassword = await page
      .locator(".credential-summary code")
      .textContent();
    expect(temporaryPassword).toHaveLength(24);
    await page.getByRole("button", { name: "表示を閉じる" }).click();
    await expect(page.locator(".credential-summary")).toHaveCount(0);
    await expect(
      page.getByText(
        "一時パスワードの表示を終了しました。再表示はできません。",
      ),
    ).toBeVisible();

    await page.getByLabel("教会名").fill(E2E_CREATED_CHURCH);
    await page.getByLabel("利用者名").fill("Synthetic Created User");
    await page.getByLabel("ログイン用メールアドレス").fill(E2E_CREATED_EMAIL);
    await page
      .getByRole("button", { name: "教会と初期アカウントを作成" })
      .click();

    await expect(page.locator(".notice-error")).toContainText(
      "作成できませんでした。入力内容を確認して、もう一度お試しください。",
    );

    await page.evaluate(() =>
      fetch("/api/auth/sign-out", {
        body: "{}",
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(E2E_CREATED_EMAIL);
    await page.getByLabel("パスワード").fill(temporaryPassword ?? "");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/change-password$/, { timeout: 20_000 });
    await expect(page.locator(".auth-card")).toHaveCSS(
      "background-color",
      "rgb(16, 16, 16)",
    );

    const selectedPassword = "n".repeat(16);
    await page.getByLabel("現在の一時パスワード").fill(temporaryPassword ?? "");
    await page
      .getByLabel("新しいパスワード", { exact: true })
      .fill(selectedPassword);
    await page.getByLabel("新しいパスワード（確認）").fill(selectedPassword);
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await page.getByRole("button", { name: "教会用画面へ" }).click();
    await expect(page).toHaveURL(/\/church$/, { timeout: 20_000 });
    await expect(
      page.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
  });
});
