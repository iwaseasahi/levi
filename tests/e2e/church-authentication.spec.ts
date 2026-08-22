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
  // Better Auth's scrypt verification can consume most of Playwright's
  // default assertion budget on a two-core CI runner.
  await expect(page).toHaveURL(/\/church$/, { timeout: 20_000 });
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeVisible();
}

const expectedUnauthorizedResourceError =
  "Failed to load resource: the server responded with a status of 401 (Unauthorized)";

test.describe("Church session lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test("keeps login across refresh and a second same-origin window, then logs out", async ({
    context,
    page,
    pageErrorGuard,
  }) => {
    pageErrorGuard.allowConsoleError(expectedUnauthorizedResourceError);
    await login(page);
    await page.reload();
    await expect(
      page.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
    const second = await context.newPage();
    await second.goto("/church");
    await expect(
      second.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
    await page.evaluate(() =>
      fetch("/api/auth/sign-out", {
        body: "{}",
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    await page.goto("/church");
    await expect(page).toHaveURL(/\/login$/);
    await second.reload();
    await expect(second).toHaveURL(/\/login$/);
  });

  test("rejects an expired session", async ({ page, pageErrorGuard }) => {
    pageErrorGuard.allowConsoleError(expectedUnauthorizedResourceError);
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

  test("rejects an explicitly revoked session", async ({
    page,
    pageErrorGuard,
  }) => {
    pageErrorGuard.allowConsoleError(expectedUnauthorizedResourceError);
    await login(page);
    await prisma.session.deleteMany({ where: { userId: E2E_AUTH_USER_ID } });
    await page.goto("/church");
    await expect(page).toHaveURL(/\/login$/);
  });
});
