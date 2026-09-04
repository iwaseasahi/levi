import { z } from "zod";
import { parseSlideTitle, SlideInputError } from "./slide";

export const slideImageUploadLimit = 10 * 1024 * 1024;
export const slideImageDimensionLimit = 8192;
export const slideImagePixelLimit = 40_000_000;
export const defaultSlideImageBytesPerChurch = 1024 * 1024 * 1024;

export const slideImageMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type SlideImageMediaType = (typeof slideImageMediaTypes)[number];

const metadataSchema = z
  .object({
    mediaType: z.enum(slideImageMediaTypes),
    byteSize: z.number().int().min(1).max(slideImageUploadLimit),
    width: z.number().int().min(1).max(slideImageDimensionLimit),
    height: z.number().int().min(1).max(slideImageDimensionLimit),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
  .refine(({ width, height }) => width * height <= slideImagePixelLimit);

export type SlideImageMetadata = z.infer<typeof metadataSchema>;
export type NormalizedSlideImage = SlideImageMetadata & {
  data: Uint8Array;
};

export type SlideImageInput = {
  title: string;
  image: NormalizedSlideImage;
};

export function parseSlideImageMetadata(value: unknown): SlideImageMetadata {
  const result = metadataSchema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}

export function parseSlideImageInput(value: {
  title: unknown;
  image: NormalizedSlideImage;
}): SlideImageInput {
  const metadata = parseSlideImageMetadata({
    mediaType: value.image.mediaType,
    byteSize: value.image.byteSize,
    width: value.image.width,
    height: value.image.height,
    checksum: value.image.checksum,
  });
  if (
    !(value.image.data instanceof Uint8Array) ||
    value.image.data.byteLength !== metadata.byteSize
  ) {
    throw new SlideInputError();
  }
  return {
    title: parseSlideTitle(value.title),
    image: { ...metadata, data: value.image.data },
  };
}
