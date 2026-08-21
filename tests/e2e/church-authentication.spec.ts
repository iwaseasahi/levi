import { expect, test } from "./fixtures";
import { prisma } from "@/infrastructure/database/client";
import {
  E2E_AUTH_USER_EMAIL,
  E2E_AUTH_USER_ID,
  E2E_PASSWORD,
} from "./operator-fixture";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(E2E_AUTH_USER_EMAIL);
  await page.getByLabel("パスワード").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/church$/);
  await expect(
    page.getByRole("heading", { name: "test.e2e auth church" }),
  ).toBeVisible();
}

test.describe("Church session lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test("keeps login across refresh and a second same-origin window, then logs out", async ({
    context,
    page,
  }) => {
    await login(page);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "test.e2e auth church" }),
    ).toBeVisible();
    const second = await context.newPage();
    await second.goto("/church");
    await expect(
      second.getByRole("heading", { name: "test.e2e auth church" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await second.reload();
    await expect(second).toHaveURL(/\/login$/);
  });

  test("rejects an expired session", async ({ page }) => {
    await login(page);
    await prisma.session.updateMany({
      where: { userId: E2E_AUTH_USER_ID },
      data: {
        createdAt: new Date(Date.now() - 172_800_000),
        expiresAt: new Date(Date.now() - 86_400_000),
      },
    });
    await page.goto("/church");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rejects an explicitly revoked session", async ({ page }) => {
    await login(page);
    await prisma.session.deleteMany({ where: { userId: E2E_AUTH_USER_ID } });
    await page.goto("/church");
    await expect(page).toHaveURL(/\/login$/);
  });
});
