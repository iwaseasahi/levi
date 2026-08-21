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

  test("creates one account, dismisses its credential, and safely rejects a retry", async ({
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
  });
});
