import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  E2E_CHURCH_USER_EMAIL,
  E2E_ADMIN_BASIC_USERNAME,
  E2E_CREATED_CHURCH,
  E2E_CREATED_EMAIL,
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
  test("challenges an unauthenticated visitor with Basic authentication", async ({
    page,
  }) => {
    const response = await page.request.get("/admin/churches/new", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toBe(
      'Basic realm="Levi Administration", charset="UTF-8"',
    );
  });

  test("does not accept a church session as operator authentication", async ({
    page,
  }) => {
    await signIn(page, E2E_CHURCH_USER_EMAIL);

    const response = await page.request.get("/admin/churches/new");

    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("教会アカウントを作成");
  });
});

test.describe("operator church provisioning", () => {
  test.describe.configure({ mode: "serial" });
  test.use({
    httpCredentials: {
      password: E2E_PASSWORD,
      username: E2E_ADMIN_BASIC_USERNAME,
    },
  });

  test("provisions an account through first login and password change", async ({
    page,
  }) => {
    await page.goto("/admin/churches/new");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "教会を作成",
      }),
    ).toBeVisible();
    await expect(page.locator(".admin-form").first()).toHaveCSS(
      "background-color",
      "rgb(17, 17, 17)",
    );
    await expect(page.getByLabel("教会名")).toHaveCSS(
      "background-color",
      "rgb(27, 27, 27)",
    );
    await expect(
      page.getByRole("button", { name: "教会と初期アカウントを作成" }),
    ).toHaveCSS("background-color", "rgb(210, 165, 104)");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });

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
    const loginPassword = page.getByLabel("パスワード", { exact: true });
    await loginPassword.fill(temporaryPassword ?? "");
    await expect(loginPassword).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "パスワードを表示" }).click();
    await expect(loginPassword).toHaveAttribute("type", "text");
    await expect(loginPassword).toHaveValue(temporaryPassword ?? "");
    await page.getByRole("button", { name: "パスワードを隠す" }).click();
    await expect(loginPassword).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/change-password$/, { timeout: 20_000 });
    await expect(page.locator(".auth-card")).toHaveCSS(
      "background-color",
      "rgba(17, 17, 17, 0.94)",
    );

    const selectedPassword = "n".repeat(16);
    const newPassword = page.getByLabel("新しいパスワード", { exact: true });
    const confirmation = page.getByLabel("新しいパスワード（確認）", {
      exact: true,
    });
    await newPassword.fill(selectedPassword);
    await confirmation.fill(selectedPassword);
    await page.getByRole("button", { name: "新しいパスワードを表示" }).click();
    await expect(newPassword).toHaveAttribute("type", "text");
    await expect(newPassword).toHaveValue(selectedPassword);
    await expect(confirmation).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "新しいパスワードを隠す" }).click();
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await page.getByRole("button", { name: "教会用画面へ" }).click();
    await expect(page).toHaveURL(/\/scripture$/, { timeout: 20_000 });
    await expect(
      page.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
  });
});
