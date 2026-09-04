import {
  defaultSlideImageBytesPerChurch,
  slideImageUploadLimit,
} from "@/domain/slides/image";

export type SlideImageRuntimeConfig = {
  bytesPerChurch: number;
};

export function parseSlideImageRuntimeConfig(
  value: string | undefined,
  nodeEnvironment: "development" | "test" | "production",
): SlideImageRuntimeConfig {
  if (value === undefined && nodeEnvironment !== "production") {
    return { bytesPerChurch: defaultSlideImageBytesPerChurch };
  }
  if (!value || !/^\d+$/.test(value)) {
    throw new Error("SLIDE_IMAGE_BYTES_PER_CHURCH must be a positive integer");
  }
  const bytesPerChurch = Number(value);
  if (
    !Number.isSafeInteger(bytesPerChurch) ||
    bytesPerChurch < slideImageUploadLimit ||
    bytesPerChurch > 10 * 1024 * 1024 * 1024
  ) {
    throw new Error(
      "SLIDE_IMAGE_BYTES_PER_CHURCH must be between 10 MiB and 10 GiB",
    );
  }
  return { bytesPerChurch };
}

export function getSlideImageRuntimeConfig(): SlideImageRuntimeConfig {
  const nodeEnvironment = process.env.NODE_ENV ?? "development";
  if (
    !(["development", "test", "production"] as const).includes(
      nodeEnvironment as "development" | "test" | "production",
    )
  ) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnvironment}`);
  }
  return parseSlideImageRuntimeConfig(
    process.env.SLIDE_IMAGE_BYTES_PER_CHURCH,
    nodeEnvironment as "development" | "test" | "production",
  );
}
