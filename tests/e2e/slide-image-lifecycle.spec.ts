import type { Locator } from "@playwright/test";

import { prisma } from "@/infrastructure/database/client";
import { test, expect } from "./scripture-fixture";
import { loginToScripture } from "./scripture-helpers";

const syntheticPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4UCEHAAPiAYcK6fxlAAAAAElFTkSuQmCC",
  "base64",
);

async function expectImageContainedBySixteenByNineFrame(frame: Locator) {
  const layout = await frame.evaluate((element) => {
    const image = element.querySelector("img");
    if (!image) throw new Error("Expected an image inside the Slide frame");
    const frameBounds = element.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    return {
      frameHeight: frameBounds.height,
      frameWidth: frameBounds.width,
      imageHeight: imageBounds.height,
      imageWidth: imageBounds.width,
    };
  });
  expect(layout.frameWidth / layout.frameHeight).toBeCloseTo(16 / 9, 2);
  expect(layout.imageWidth).toBeCloseTo(layout.frameWidth, 0);
  expect(layout.imageHeight).toBeCloseTo(layout.frameHeight, 0);
}

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
  await expectImageContainedBySixteenByNineFrame(
    page
      .getByRole("region", { name: "画像プレビュー" })
      .locator(".slide-image-frame"),
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic image lifecycle" }),
  ).toBeVisible();
  const savedPreview = page.getByRole("region", { name: "画像プレビュー" });
  await expect(savedPreview.getByRole("img")).toBeVisible();
  await expectImageContainedBySixteenByNineFrame(
    savedPreview.locator(".slide-image-frame"),
  );

  const stored = await prisma.slide.findFirstOrThrow({
    where: { churchId: scriptureAccount.churchId },
    include: { image: true },
  });
  expect(stored).toMatchObject({ body: null, contentType: "IMAGE" });
  expect(stored.image).toMatchObject({
    mediaType: "image/png",
    width: 1,
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
  const audienceFrame = audience.locator(".slide-image-frame");
  await expect(audienceFrame).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expectImageContainedBySixteenByNineFrame(audienceFrame);
  await expect(
    controller.getByRole("button", { name: "文字を大きく" }),
  ).toHaveCount(0);
  await controller
    .getByRole("button", { name: "空白と表示を切り替え" })
    .click();
  await expect(audience.getByRole("main", { name: "空白投影" })).toBeVisible();
  await expect(projected).toHaveCount(0);
});
