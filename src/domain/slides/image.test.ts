import { describe, expect, it } from "vitest";
import {
  parseSlideImageInput,
  parseSlideImageMetadata,
  slideImageDimensionLimit,
  slideImagePixelLimit,
  slideImageUploadLimit,
} from "./image";

const metadata = {
  mediaType: "image/png" as const,
  byteSize: 3,
  width: 1,
  height: 1,
  checksum: "a".repeat(64),
};

describe("Slide image contract", () => {
  it("normalizes the title and preserves verified binary metadata", () => {
    expect(
      parseSlideImageInput({
        title: " Image ",
        image: { ...metadata, data: new Uint8Array([1, 2, 3]) },
      }),
    ).toMatchObject({ title: "Image", image: metadata });
  });

  it.each([
    { ...metadata, mediaType: "image/gif" },
    { ...metadata, byteSize: 0 },
    { ...metadata, byteSize: slideImageUploadLimit + 1 },
    { ...metadata, width: slideImageDimensionLimit + 1 },
    { ...metadata, height: slideImageDimensionLimit + 1 },
    {
      ...metadata,
      width: 8000,
      height: Math.ceil(slideImagePixelLimit / 8000) + 1,
    },
    { ...metadata, checksum: "A".repeat(64) },
    { ...metadata, objectKey: "forged" },
  ])("rejects invalid or server-owned metadata %#", (value) => {
    expect(() => parseSlideImageMetadata(value)).toThrow("INVALID_SLIDE_INPUT");
  });

  it("rejects a byte-length mismatch", () => {
    expect(() =>
      parseSlideImageInput({
        title: "Image",
        image: { ...metadata, data: new Uint8Array([1, 2]) },
      }),
    ).toThrow("INVALID_SLIDE_INPUT");
  });
});
