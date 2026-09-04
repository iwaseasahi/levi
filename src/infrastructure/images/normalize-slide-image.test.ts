import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { slideImageUploadLimit } from "@/domain/slides/image";
import { normalizeSlideImage } from "./normalize-slide-image";

describe("Slide image normalization", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ] as const)(
    "validates and normalizes static %s without metadata",
    async (format, expected) => {
      const source = sharp({
        create: { width: 4, height: 3, channels: 3, background: "#336699" },
      }).withMetadata({ orientation: 6 });
      const bytes = await source[format]().toBuffer();
      const result = await normalizeSlideImage(bytes);
      expect(result).toMatchObject({
        mediaType: expected,
        width: 3,
        height: 4,
        byteSize: result.data.byteLength,
      });
      expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
      const metadata = await sharp(result.data).metadata();
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.exif).toBeUndefined();
    },
  );

  it.each([
    new Uint8Array(),
    new TextEncoder().encode("not an image"),
    new Uint8Array(slideImageUploadLimit + 1),
  ])("rejects empty, invalid, and oversized bytes", async (bytes) => {
    await expect(normalizeSlideImage(bytes)).rejects.toThrow(
      "INVALID_SLIDE_INPUT",
    );
  });

  it("rejects unsupported GIF input", async () => {
    const gif = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "white" },
    })
      .gif()
      .toBuffer();
    await expect(normalizeSlideImage(gif)).rejects.toThrow(
      "INVALID_SLIDE_INPUT",
    );
  });

  it("rejects SVG and animated WebP input", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    );
    const frames = await Promise.all(
      ["red", "blue"].map((background) =>
        sharp({
          create: { width: 1, height: 1, channels: 3, background },
        })
          .png()
          .toBuffer(),
      ),
    );
    const animatedWebp = await sharp(frames, { join: { animated: true } })
      .webp({ delay: [100, 100], loop: 0 })
      .toBuffer();
    await expect(normalizeSlideImage(svg)).rejects.toThrow(
      "INVALID_SLIDE_INPUT",
    );
    await expect(normalizeSlideImage(animatedWebp)).rejects.toThrow(
      "INVALID_SLIDE_INPUT",
    );
  });
});
