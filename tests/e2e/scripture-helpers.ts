import type { BrowserContext, Page } from "@playwright/test";

import { expect } from "./scripture-fixture";
import type { ScriptureAccount } from "./scripture-fixture";

export type ScriptureLanguage = "ja" | "en" | "both";

const languageLabels: Record<ScriptureLanguage, string> = {
  both: "日本語 & English",
  en: "English Only",
  ja: "日本語のみ",
};

export async function loginToScripture(
  context: BrowserContext,
  page: Page,
  account: ScriptureAccount,
) {
  await context.addCookies([
    {
      httpOnly: true,
      name: "better-auth.session_token",
      sameSite: "Lax",
      url: "http://127.0.0.1:3100",
      value: account.signedSessionToken,
    },
  ]);
  await page.goto("/scripture");
  await expect(page).toHaveURL(/\/scripture$/, { timeout: 20_000 });
}

export async function expectScriptureCatalog(page: Page) {
  await expect(
    page.getByRole("radio", { name: "創世記/Genesis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "出エジプト記/Exodus" }),
  ).toBeVisible();
}

export async function selectGenesis(
  page: Page,
  {
    endVerse = "2",
    language = "both",
    startVerse = "1",
  }: {
    endVerse?: string;
    language?: ScriptureLanguage;
    startVerse?: string;
  } = {},
) {
  await page.getByRole("radio", { name: languageLabels[language] }).click();
  await page.getByRole("radio", { name: "創世記/Genesis" }).click();
  await page.getByLabel("章").fill("1");
  await expect(page.getByLabel("開始節")).toBeEnabled();
  await page.getByLabel("開始節").fill(startVerse);
  await page.getByLabel("終了節（省略可）").fill(endVerse);
}

export async function openGenesisAudience(
  context: BrowserContext,
  page: Page,
  {
    endVerse = "2",
    expectedEndVerse = endVerse || "3",
    language = "both",
    startVerse = "1",
  }: {
    endVerse?: string;
    expectedEndVerse?: string;
    language?: ScriptureLanguage;
    startVerse?: string;
  } = {},
) {
  await selectGenesis(page, { endVerse, language, startVerse });
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const audience = await opened;
  await expect(page).toHaveURL(/\/scripture$/);
  await expect(audience).toHaveURL(
    new RegExp(
      `/scripture/audience\\?book=GEN&chapter=1&endVerse=${expectedEndVerse}&language=${language}&startVerse=${startVerse}$`,
    ),
  );
  return audience;
}
