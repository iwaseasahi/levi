import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

const syntheticPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQImWMwTptpnDYTAAeZAmUGcC4NAAAAAElFTkSuQmCC",
  "base64",
);

test("an image Slide is previewed, saved, projected with contain sizing, and blanked", async ({
  context,
  page,
  scriptureAccount,
}) => {
  await loginToScripture(context, page, scriptureAccount);
  await page.goto("/slides/new");
  await page.getByRole("radio", { name: "画像" }).click();
  await page.getByLabel("タイトル").fill("Synthetic image lifecycle");
  await page.getByRole("button", { name: "画像" }).setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: syntheticPng,
  });
  await page.getByRole("button", { name: "保存前プレビュー" }).click();
  await expect(
    page.getByRole("region", { name: "画像プレビュー" }).getByRole("img"),
  ).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic image lifecycle" }),
  ).toBeVisible();

  const stored = await prisma.slide.findFirstOrThrow({
    where: { churchId: scriptureAccount.churchId },
    include: { image: true },
  });
  expect(stored).toMatchObject({ body: null, contentType: "IMAGE" });
  expect(stored.image).toMatchObject({
    mediaType: "image/png",
    width: 2,
    height: 1,
  });
  expect(stored.image?.data.byteLength).toBeGreaterThan(0);

  const controller = page.getByRole("region", { name: "投影操作" });
  const opened = context.waitForEvent("page");
  await controller.getByRole("button", { name: "Open" }).click();
  const audience = await opened;
  const projected = audience.getByRole("img", {
    name: "Synthetic image lifecycle",
  });
  await expect(projected).toBeVisible();
  await expect(projected).toHaveCSS("object-fit", "contain");
  await expect(audience.locator(".slide-image-frame")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(
    controller.getByRole("button", { name: "文字を大きく" }),
  ).toHaveCount(0);
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await expect(projected).toHaveCount(0);
});
