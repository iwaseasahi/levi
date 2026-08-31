import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  E2E_CHURCH_USER_EMAIL,
  E2E_ADDITIONAL_CHURCH_USER_EMAIL,
  E2E_ACTIVE_ADMIN_EMAIL,
  E2E_ADMIN_BASIC_USERNAME,
  E2E_CREATED_CHURCH,
  E2E_CREATED_EMAIL,
  E2E_INVITED_ADMIN_EMAIL,
  E2E_INITIAL_ADMIN_EMAIL,
  E2E_PASSWORD,
} from "./operator-fixture";

// Administration scenarios change live credentials. Keep this file out of
// screenshots, traces, and videos so credentials cannot enter CI artifacts.
test.use({ screenshot: "off", trace: "off", video: "off" });

const mailpitApiUrl =
  process.env.E2E_MAILPIT_API_URL ?? "http://127.0.0.1:8027";

async function signIn(page: Page, email: string) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: E2E_PASSWORD },
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(response.ok()).toBe(true);
}

async function signInAdmin(
  page: Page,
  email = E2E_ACTIVE_ADMIN_EMAIL,
  password = E2E_PASSWORD,
) {
  await page.goto("/admin/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function findPasswordResetUrl(
  page: Page,
  recipient: string,
  audience: "admin" | "church" = "admin",
  purpose: "setup" | "reset" = "setup",
) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${mailpitApiUrl}/api/v1/messages`,
        );
        if (!response.ok()) return undefined;
        const payload = (await response.json()) as {
          messages: Array<{
            ID: string;
            To: Array<{ Address: string }>;
          }>;
        };
        return payload.messages.find((message) =>
          message.To.some(({ Address }) => Address === recipient),
        )?.ID;
      },
      { timeout: 20_000 },
    )
    .not.toBeUndefined();

  const messagesResponse = await page.request.get(
    `${mailpitApiUrl}/api/v1/messages`,
  );
  const messages = (await messagesResponse.json()) as {
    messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
  };
  const messageId = messages.messages.find((message) =>
    message.To.some(({ Address }) => Address === recipient),
  )?.ID;
  expect(messageId).toBeDefined();
  const messageResponse = await page.request.get(
    `${mailpitApiUrl}/api/v1/message/${messageId}`,
  );
  expect(messageResponse.ok()).toBe(true);
  const message = (await messageResponse.json()) as {
    Text: string;
    Subject: string;
  };
  expect(message.Subject).toBe(
    `Levi ${audience === "admin" ? "管理者" : "教会利用者"}パスワードの${purpose === "setup" ? "設定" : "再設定"}`,
  );
  expect(message.Text).toContain("有効期限は3日間");
  expect(message.Text).toContain(
    purpose === "setup" ? "初回パスワードを設定" : "パスワードを再設定",
  );
  const resetPath = audience === "admin" ? "admin-auth" : "auth";
  const resetUrl = message.Text.match(
    new RegExp(
      `https?:\\/\\/\\S+\\/api\\/${resetPath}\\/reset-password\\/[^\\s]+`,
    ),
  )?.[0];
  expect(resetUrl).toBeDefined();
  return resetUrl as string;
}

test.describe("operator administration access", () => {
  test("challenges an unauthenticated visitor with Basic authentication", async ({
    page,
  }) => {
    const response = await page.request.get("/admin", {
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

    const response = await page.request.get("/admin/churches");

    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("教会一覧");
  });

  test("requires an individual administrator login after Basic authentication", async ({
    page,
  }) => {
    const response = await page.request.get("/admin", {
      headers: {
        authorization: `Basic ${Buffer.from(`${E2E_ADMIN_BASIC_USERNAME}:${E2E_PASSWORD}`).toString("base64")}`,
      },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/admin/login");
  });
});

test.describe("administrator invitations", () => {
  test.use({
    httpCredentials: {
      password: E2E_PASSWORD,
      username: E2E_ADMIN_BASIC_USERNAME,
    },
  });

  test("uses the protected administration dashboard as the entry point", async ({
    page,
  }) => {
    await signInAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "管理画面" }),
    ).toBeVisible();
    const dashboard = page.getByRole("navigation", { name: "管理機能" });
    await expect(
      dashboard.getByRole("link", { name: /教会の一覧/ }),
    ).toBeVisible();
    await expect(
      dashboard.getByRole("link", { name: /教会を作成/ }),
    ).toBeVisible();
    await expect(
      dashboard.getByRole("link", { name: /パスワードを再設定/ }),
    ).toHaveCount(0);
    await expect(
      dashboard.getByRole("link", { name: /管理者の一覧/ }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("lists registered churches and their users", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/churches");

    await expect(
      page.getByRole("heading", { level: 1, name: "教会一覧" }),
    ).toBeVisible();
    await expect(page.getByText("test.e2e member church")).toBeVisible();
    await expect(page.getByText(E2E_CHURCH_USER_EMAIL)).toBeVisible();
    await expect(page.getByText("有効").first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("invites an administrator and lists the pending identity", async ({
    page,
  }) => {
    await signInAdmin(page);
    await page.goto("/admin/admin-users/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "管理者を招待" }),
    ).toBeVisible();
    await page.getByLabel("管理者名").fill("Synthetic Invited Administrator");
    await page.getByLabel("メールアドレス").fill(E2E_INVITED_ADMIN_EMAIL);
    await page.getByRole("button", { name: "管理者を招待" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "管理者へ招待メールを送信しました。" }),
    ).toBeVisible();
    await expect(page.getByText(E2E_INVITED_ADMIN_EMAIL)).toBeVisible();
    await findPasswordResetUrl(page, E2E_INVITED_ADMIN_EMAIL);
    await page.getByRole("button", { name: "表示を閉じる" }).click();
    await page.getByRole("link", { name: "管理者の一覧へ" }).click();
    await expect(page).toHaveURL(/\/admin\/admin-users$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "管理者の一覧" }),
    ).toBeVisible();
    await expect(page.getByText("basic-bootstrap")).toHaveCount(0);
    await expect(
      page.getByText(E2E_INVITED_ADMIN_EMAIL, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".admin-user-list li")
        .filter({ hasText: E2E_INVITED_ADMIN_EMAIL })
        .getByText("初回パスワード変更待ち"),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .locator(".admin-user-list li")
      .filter({ hasText: E2E_INVITED_ADMIN_EMAIL })
      .getByRole("button", { name: "削除" })
      .click();
    await expect(page.getByText(E2E_INVITED_ADMIN_EMAIL)).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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

  test("invites an account and lets the user set and change a password", async ({
    page,
  }) => {
    await signInAdmin(page);
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
      hasText: "教会利用者へ招待メールを送信しました。",
    });
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
    await expect(success).toContainText(E2E_CREATED_EMAIL);
    await expect(success).toContainText("3日間");
    const resetUrl = await findPasswordResetUrl(
      page,
      E2E_CREATED_EMAIL,
      "church",
    );

    await page.getByLabel("教会名").fill(E2E_CREATED_CHURCH);
    await page.getByLabel("利用者名").fill("Synthetic Created User");
    await page.getByLabel("ログイン用メールアドレス").fill(E2E_CREATED_EMAIL);
    await page
      .getByRole("button", { name: "教会と初期アカウントを作成" })
      .click();

    await expect(page.locator(".notice-error")).toContainText(
      "作成できませんでした。入力内容を確認して、もう一度お試しください。",
    );

    await page.goto(resetUrl);
    await expect(
      page.getByRole("heading", { name: "新しいパスワードを設定" }),
    ).toBeVisible();
    const initialPassword = "n".repeat(16);
    await page
      .getByLabel("新しいパスワード", { exact: true })
      .fill(initialPassword);
    await page
      .getByLabel("新しいパスワード（確認）", { exact: true })
      .fill(initialPassword);
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page).toHaveURL(/\/login\?passwordReset=completed$/);

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(E2E_CREATED_EMAIL);
    const loginPassword = page.getByLabel("パスワード", { exact: true });
    await loginPassword.fill(initialPassword);
    await expect(loginPassword).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "パスワードを表示" }).click();
    await expect(loginPassword).toHaveAttribute("type", "text");
    await expect(loginPassword).toHaveValue(initialPassword);
    await page.getByRole("button", { name: "パスワードを隠す" }).click();
    await expect(loginPassword).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/scripture$/, { timeout: 20_000 });

    await page.goto("/account/change-password");
    await expect(
      page.getByRole("heading", { name: "パスワードを変更" }),
    ).toBeVisible();
    await page
      .getByLabel("現在のパスワード", { exact: true })
      .fill(initialPassword);
    const selectedPassword = "m".repeat(16);
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
    await expect(page.getByRole("status")).toContainText(
      "パスワードを変更しました。",
    );
    await page.getByRole("link", { name: "聖書検索へ戻る" }).click();
    await expect(page).toHaveURL(/\/scripture$/);
    await expect(
      page.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
  });

  test("invites a second user to an existing church", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/churches");
    await page
      .getByRole("link", {
        name: "test.e2e member churchに利用者を招待",
      })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "利用者を招待" }),
    ).toBeVisible();

    await page.getByLabel("利用者名").fill("Synthetic Additional User");
    await page
      .getByLabel("ログイン用メールアドレス")
      .fill(E2E_ADDITIONAL_CHURCH_USER_EMAIL);
    await page.getByRole("button", { name: "利用者を招待" }).click();
    const success = page.getByRole("status").filter({
      hasText: "教会利用者へ招待メールを送信しました。",
    });
    await expect(success).toContainText(E2E_ADDITIONAL_CHURCH_USER_EMAIL);

    const resetUrl = await findPasswordResetUrl(
      page,
      E2E_ADDITIONAL_CHURCH_USER_EMAIL,
      "church",
    );
    await page.goto(resetUrl);
    const password = "additional-user-password";
    await page.getByLabel("新しいパスワード", { exact: true }).fill(password);
    await page
      .getByLabel("新しいパスワード（確認）", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page).toHaveURL(/\/login\?passwordReset=completed$/);

    await page
      .getByLabel("メールアドレス")
      .fill(E2E_ADDITIONAL_CHURCH_USER_EMAIL);
    await page.getByLabel("パスワード", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/scripture$/, { timeout: 20_000 });
    await expect(
      page.getByRole("radio", { name: "創世記/Genesis" }),
    ).toBeVisible();
  });
});

test.describe("administrator password setup", () => {
  test.use({
    httpCredentials: {
      password: E2E_PASSWORD,
      username: E2E_ADMIN_BASIC_USERNAME,
    },
  });

  for (const audience of ["church", "admin"] as const) {
    test(`sends a separate reset email for an active ${audience} user`, async ({
      page,
    }) => {
      await page.goto(
        audience === "admin" ? "/admin/forgot-password" : "/forgot-password",
      );
      const email =
        audience === "admin" ? E2E_ACTIVE_ADMIN_EMAIL : E2E_CHURCH_USER_EMAIL;
      await page.getByLabel("メールアドレス").fill(email);
      await page.getByRole("button", { name: "再設定メールを送信" }).click();
      await expect(page.getByRole("status")).toContainText(
        "再設定メールを送信しました",
      );
      await findPasswordResetUrl(page, email, audience, "reset");
    });
  }

  test("activates an invited administrator through the emailed reset link", async ({
    page,
  }) => {
    await page.goto("/admin/forgot-password");
    await page.getByLabel("メールアドレス").fill(E2E_INITIAL_ADMIN_EMAIL);
    await page.getByRole("button", { name: "再設定メールを送信" }).click();
    await expect(page.getByRole("status")).toContainText(
      "再設定メールを送信しました",
    );

    const resetUrl = await findPasswordResetUrl(page, E2E_INITIAL_ADMIN_EMAIL);
    await page.goto(resetUrl);
    await expect(
      page.getByRole("heading", { name: "新しいパスワードを設定" }),
    ).toBeVisible();

    const selectedPassword = "activated-admin-password";
    await page
      .getByLabel("新しいパスワード", { exact: true })
      .fill(selectedPassword);
    await page
      .getByLabel("新しいパスワード（確認）", { exact: true })
      .fill(selectedPassword);
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?passwordReset=completed$/);

    await page.getByLabel("メールアドレス").fill(E2E_INITIAL_ADMIN_EMAIL);
    await page.getByLabel("パスワード", { exact: true }).fill(selectedPassword);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});
