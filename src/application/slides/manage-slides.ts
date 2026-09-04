import type { ChurchScope } from "@/application/auth/church-access";
import {
  defaultSlideImageBytesPerChurch,
  parseSlideImageInput,
  type NormalizedSlideImage,
  type SlideImageInput,
  type SlideImageMetadata,
} from "@/domain/slides/image";
import { parseSlideInput, type SlideInput } from "@/domain/slides/slide";
import {
  parseSlideId,
  parseSlideDeletion,
  parseSlideRevision,
  parseSlideUpdate,
  SlideError,
  type SlideRecord,
} from "@/domain/slides/commands";

export interface SlideImageStorage {
  createImage(
    scope: ChurchScope,
    input: SlideImageInput,
    bytesPerChurch: number,
  ): Promise<SlideRecord>;
  findImage(
    scope: ChurchScope,
    id: string,
    revision: number,
  ): Promise<(SlideImageMetadata & { data: Uint8Array }) | null>;
  updateImageTitle(
    scope: ChurchScope,
    id: string,
    expectedRevision: number,
    title: string,
  ): Promise<SlideRecord>;
  updateImage(
    scope: ChurchScope,
    id: string,
    expectedRevision: number,
    input: SlideImageInput,
    bytesPerChurch: number,
  ): Promise<SlideRecord>;
  getImageUsage(scope: ChurchScope): Promise<number>;
  delete(
    scope: ChurchScope,
    id: string,
    expectedRevision: number,
  ): Promise<void>;
}

export interface SlideRepository extends Partial<SlideImageStorage> {
  create(scope: ChurchScope, input: SlideInput): Promise<SlideRecord>;
  find(scope: ChurchScope, id: string): Promise<SlideRecord | null>;
  update(
    scope: ChurchScope,
    id: string,
    expectedRevision: number,
    input: SlideInput,
  ): Promise<SlideRecord>;
  delete(
    scope: ChurchScope,
    id: string,
    expectedRevision: number,
  ): Promise<void>;
}

export function createSlideService(
  repository: SlideRepository,
  options: { imageBytesPerChurch?: number } = {},
) {
  const imageBytesPerChurch =
    options.imageBytesPerChurch ?? defaultSlideImageBytesPerChurch;
  return {
    create(scope: ChurchScope, input: unknown) {
      return repository.create(scope, parseSlideInput(input));
    },
    createImage(
      scope: ChurchScope,
      title: unknown,
      image: NormalizedSlideImage,
    ) {
      if (!repository.createImage) throw new Error("Image storage unavailable");
      return repository.createImage(
        scope,
        parseSlideImageInput({ title, image }),
        imageBytesPerChurch,
      );
    },
    async get(scope: ChurchScope, id: unknown) {
      const slide = await repository.find(scope, parseSlideId(id));
      if (!slide) throw new SlideError("SLIDE_NOT_FOUND");
      return slide;
    },
    async getImage(scope: ChurchScope, id: unknown, revision: unknown) {
      if (!repository.findImage) throw new Error("Image storage unavailable");
      const image = await repository.findImage(
        scope,
        parseSlideId(id),
        parseSlideRevision(revision),
      );
      if (!image) throw new SlideError("SLIDE_NOT_FOUND");
      return image;
    },
    getImageUsage(scope: ChurchScope) {
      if (!repository.getImageUsage)
        throw new Error("Image storage unavailable");
      return repository.getImageUsage(scope);
    },
    update(scope: ChurchScope, id: unknown, value: unknown) {
      const update = parseSlideUpdate(value);
      if (update.contentType === "image") {
        if (!repository.updateImageTitle)
          throw new Error("Image storage unavailable");
        return repository.updateImageTitle(
          scope,
          parseSlideId(id),
          update.expectedRevision,
          update.title,
        );
      }
      return repository.update(
        scope,
        parseSlideId(id),
        update.expectedRevision,
        update.input,
      );
    },
    updateImage(
      scope: ChurchScope,
      id: unknown,
      expectedRevision: unknown,
      title: unknown,
      image: NormalizedSlideImage,
    ) {
      if (!repository.updateImage) throw new Error("Image storage unavailable");
      return repository.updateImage(
        scope,
        parseSlideId(id),
        parseSlideRevision(expectedRevision),
        parseSlideImageInput({ title, image }),
        imageBytesPerChurch,
      );
    },
    delete(scope: ChurchScope, id: unknown, value: unknown) {
      const input = parseSlideDeletion(value);
      return repository.delete(scope, parseSlideId(id), input.expectedRevision);
    },
  };
}
