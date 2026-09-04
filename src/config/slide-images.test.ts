import { describe, expect, it } from "vitest";
import { defaultSlideImageBytesPerChurch } from "@/domain/slides/image";
import { parseSlideImageRuntimeConfig } from "./slide-images";

describe("Slide image runtime configuration", () => {
  it("uses a bounded local default outside production", () => {
    expect(parseSlideImageRuntimeConfig(undefined, "development")).toEqual({
      bytesPerChurch: defaultSlideImageBytesPerChurch,
    });
    expect(parseSlideImageRuntimeConfig(undefined, "test")).toEqual({
      bytesPerChurch: defaultSlideImageBytesPerChurch,
    });
  });

  it("requires an explicit production quota", () => {
    expect(() => parseSlideImageRuntimeConfig(undefined, "production")).toThrow(
      "SLIDE_IMAGE_BYTES_PER_CHURCH",
    );
    expect(
      parseSlideImageRuntimeConfig(String(1024 * 1024 * 1024), "production"),
    ).toEqual({ bytesPerChurch: 1024 * 1024 * 1024 });
  });

  it.each(["", "1.5", "abc", "10485759", "10737418241"])(
    "rejects unsafe quota %j",
    (value) => {
      expect(() => parseSlideImageRuntimeConfig(value, "production")).toThrow();
    },
  );
});
