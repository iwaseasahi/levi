import { expect, test as base } from "@playwright/test";

type PageErrorGuard = {
  allowConsoleError(message: string): void;
};

export const test = base.extend<{ pageErrorGuard: PageErrorGuard }>({
  pageErrorGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowedConsoleErrors = new Set<string>();

      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(`console.error: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        errors.push(`pageerror: ${error.message}`);
      });

      await use({
        allowConsoleError(message) {
          allowedConsoleErrors.add(`console.error: ${message}`);
        },
      });

      expect(
        errors.filter((error) => !allowedConsoleErrors.has(error)),
        "unexpected browser console and page errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
