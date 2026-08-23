import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

test("minimal home directs users to login while health remains available", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "礼拝投影システム Levi",
    }),
  ).toBeVisible();
  const loginLink = page.getByRole("link", { name: "ログイン" });
  await expect(loginLink).toHaveAttribute("href", "/login");
  await expect(loginLink).toHaveCSS("background-color", "rgb(210, 165, 104)");
  await expect(page.locator(".card > *")).toHaveCount(2);
  await expect(page.locator(".card p, .card .eyebrow")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /health/i })).toHaveCount(0);

  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".card")).toHaveCSS(
    "background-color",
    "rgba(17, 17, 17, 0.94)",
  );
  await expect(page.locator(".card")).toHaveCSS("color", "rgb(255, 255, 255)");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await loginLink.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "ログイン" }),
  ).toBeVisible();
  await expect(page.locator(".auth-card")).toHaveCSS(
    "background-color",
    "rgba(17, 17, 17, 0.94)",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveCSS(
    "background-color",
    "rgb(27, 27, 27)",
  );
  await expect(page.getByRole("button", { name: "ログイン" })).toHaveCSS(
    "background-color",
    "rgb(210, 165, 104)",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    service: "levi",
    status: "ok",
  });
});
