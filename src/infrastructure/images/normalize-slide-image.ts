import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  slideImageDimensionLimit,
  slideImagePixelLimit,
  slideImageUploadLimit,
  type NormalizedSlideImage,
  type SlideImageMediaType,
} from "@/domain/slides/image";
import { SlideInputError } from "@/domain/slides/slide";

const maximumConcurrentNormalizations = 2;
const maximumQueuedNormalizations = 4;
const normalizationTimeoutMs = 30_000;
let activeNormalizations = 0;
const waiters: Array<() => void> = [];

async function withNormalizationSlot<T>(operation: () => Promise<T>) {
  if (activeNormalizations >= maximumConcurrentNormalizations) {
    if (waiters.length >= maximumQueuedNormalizations)
      throw new SlideInputError();
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  activeNormalizations += 1;
  try {
    return await operation();
  } finally {
    activeNormalizations -= 1;
    waiters.shift()?.();
  }
}

function withTimeout<T>(operation: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SlideInputError()),
      normalizationTimeoutMs,
    );
    timer.unref();
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function mediaType(format: string | undefined): SlideImageMediaType {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  throw new SlideInputError();
}

export async function normalizeSlideImage(
  input: Uint8Array,
): Promise<NormalizedSlideImage> {
  if (input.byteLength < 1 || input.byteLength > slideImageUploadLimit) {
    throw new SlideInputError();
  }
  return withTimeout(
    withNormalizationSlot(async () => {
      try {
        const source = Buffer.from(input);
        const metadata = await sharp(source, {
          animated: true,
          failOn: "warning",
          limitInputPixels: slideImagePixelLimit,
        }).metadata();
        const resolvedMediaType = mediaType(metadata.format);
        if (
          (metadata.pages ?? 1) !== 1 ||
          !metadata.width ||
          !metadata.height ||
          metadata.width > slideImageDimensionLimit ||
          metadata.height > slideImageDimensionLimit ||
          metadata.width * metadata.height > slideImagePixelLimit
        ) {
          throw new SlideInputError();
        }

        let pipeline = sharp(source, {
          failOn: "warning",
          limitInputPixels: slideImagePixelLimit,
        }).rotate();
        pipeline =
          resolvedMediaType === "image/jpeg"
            ? pipeline.jpeg({ quality: 90 })
            : resolvedMediaType === "image/png"
              ? pipeline.png({ compressionLevel: 9 })
              : pipeline.webp({ quality: 90 });
        const normalized = await pipeline.toBuffer({ resolveWithObject: true });
        if (
          normalized.data.byteLength < 1 ||
          normalized.data.byteLength > slideImageUploadLimit ||
          normalized.info.width > slideImageDimensionLimit ||
          normalized.info.height > slideImageDimensionLimit ||
          normalized.info.width * normalized.info.height > slideImagePixelLimit
        ) {
          throw new SlideInputError();
        }
        return {
          mediaType: resolvedMediaType,
          byteSize: normalized.data.byteLength,
          width: normalized.info.width,
          height: normalized.info.height,
          checksum: createHash("sha256").update(normalized.data).digest("hex"),
          data: new Uint8Array(normalized.data),
        };
      } catch (cause) {
        if (cause instanceof SlideInputError) throw cause;
        throw new SlideInputError();
      }
    }),
  );
}
