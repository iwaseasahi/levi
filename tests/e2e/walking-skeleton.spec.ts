import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

test("home and health endpoint form a working skeleton", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Levi is ready for its first vertical slice.",
    }),
  ).toBeVisible();
  const healthLink = page.getByRole("link", { name: "View health status" });
  await expect(healthLink).toHaveAttribute("href", "/api/health");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  await expect(healthResponse.json()).resolves.toMatchObject({
    service: "levi",
    status: "ok",
  });
});
