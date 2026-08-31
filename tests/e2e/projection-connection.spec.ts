import { expect, test } from "./scripture-fixture";
import {
  loginToScripture,
  openGenesisAudience,
  selectGenesis,
} from "./scripture-helpers";

test("a reused projector follows its new controller and rejects the previous connection", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  const audience = await openGenesisAudience(context, page);
  await expect(
    page.getByRole("button", { name: "次の御言葉へ" }),
  ).toBeEnabled();
  const originalHash = new URL(audience.url()).hash;
  // Same coordinates plus a new generation is a fragment-only navigation.
  await page.getByRole("button", { name: "空白と表示を切り替え" }).click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect.poll(() => new URL(audience.url()).hash).not.toBe(originalHash);
  await expect(
    audience.getByText("初めに、神が天と地を創造した。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "次の御言葉へ" }),
  ).toBeEnabled();
  expect(context.pages()).toHaveLength(2);

  const opened = context.waitForEvent("page");
  await page.evaluate(() => {
    window.open("/scripture", "synthetic-second-controller");
  });
  const second = await opened;
  await selectGenesis(second, { startVerse: "2", endVerse: "2" });
  await second.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    audience.getByRole("heading", { name: "新改訳聖書第3版 創世記 1:2" }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "次の御言葉へ" }),
  ).toBeEnabled();
  expect(context.pages()).toHaveLength(3);
  // Even a manually posted old-generation command cannot affect the reused tab.
  await page.evaluate((oldGeneration) => {
    window.open("", "projector")?.postMessage(
      {
        schema: "levi.direct-audience",
        version: 2,
        type: "CONTROL",
        kind: "scripture",
        generation: oldGeneration,
        instance: oldGeneration,
        sequence: 999,
        command: { action: "toggle-blank" },
      },
      location.origin,
    );
  }, originalHash.slice(6));
  await expect(
    audience.getByRole("heading", { name: "新改訳聖書第3版 創世記 1:2" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "次の御言葉へ" })).toBeDisabled(
    { timeout: 8_000 },
  );
  await second.getByRole("button", { name: "前の御言葉へ" }).click();
  await expect(
    audience.getByRole("heading", { name: "新改訳聖書第3版 創世記 1:1" }),
  ).toBeVisible();
  await audience.reload();
  await expect(
    second.getByRole("button", { name: "次の御言葉へ" }),
  ).toBeEnabled();
  await second.getByRole("button", { name: "空白と表示を切り替え" }).click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
});
