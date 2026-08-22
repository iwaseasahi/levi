import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

test("home directs users to login while health remains available", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "礼拝投影システム Levi",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("教会用画面を利用するには、ログインしてください。"),
  ).toBeVisible();
  const loginLink = page.getByRole("link", { name: "ログイン画面へ" });
  await expect(loginLink).toHaveAttribute("href", "/login");
  await expect(loginLink).toHaveCSS("background-color", "rgb(210, 134, 50)");
  await expect(page.getByRole("link", { name: /health/i })).toHaveCount(0);

  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".card")).toHaveCSS(
    "background-color",
    "rgb(16, 16, 16)",
  );
  await expect(page.locator(".card")).toHaveCSS("color", "rgb(255, 255, 255)");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await loginLink.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "ログイン" }),
  ).toBeVisible();

  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    service: "levi",
    status: "ok",
  });
});
