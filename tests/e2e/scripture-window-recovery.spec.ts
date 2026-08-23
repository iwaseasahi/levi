import { expect, test } from "./scripture-fixture";
import { loginToScripture, openGenesisAudience } from "./scripture-helpers";

test("recovers the audience after reload, close, and reopen", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  let audience = await openGenesisAudience(context, page, {
    endVerse: "",
    expectedEndVerse: "3",
  });
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();

  await audience.reload();
  await expect(
    audience.getByRole("heading", {
      name: "新改訳聖書第3版 創世記 1:1",
    }),
  ).toBeVisible();

  const larger = page.getByRole("button", { name: "文字を大きく" });
  await audience.close();
  await expect(larger).toBeDisabled({ timeout: 3_000 });

  const audienceReopened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  audience = await audienceReopened;
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(larger).toBeEnabled();
  await audience.close();
});
