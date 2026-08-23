import { expect, test as base } from "@playwright/test";

type PageErrorGuard = {
  allowConsoleError(message: string): void;
};

export const test = base.extend<{ pageErrorGuard: PageErrorGuard }>({
  pageErrorGuard: [
    async ({ context, page }, use) => {
      const errors: string[] = [];
      const allowedConsoleErrors = new Set<string>();
      const observedPages = new WeakSet<typeof page>();
      const observePage = (observedPage: typeof page) => {
        if (observedPages.has(observedPage)) return;
        observedPages.add(observedPage);
        observedPage.on("console", (message) => {
          if (message.type() === "error") {
            errors.push(`console.error: ${message.text()}`);
          }
        });
        observedPage.on("pageerror", (error) => {
          errors.push(`pageerror: ${error.message}`);
        });
      };

      observePage(page);
      context.on("page", observePage);

      await use({
        allowConsoleError(message) {
          allowedConsoleErrors.add(`console.error: ${message}`);
        },
      });

      context.off("page", observePage);

      expect(
        errors.filter((error) => !allowedConsoleErrors.has(error)),
        "unexpected browser console and page errors",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
