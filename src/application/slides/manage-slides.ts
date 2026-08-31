import type { ChurchScope } from "@/application/auth/church-access";
import { parseSlideInput, type SlideInput } from "@/domain/slides/slide";
import {
  parseSlideId,
  parseSlideDeletion,
  parseSlideUpdate,
  SlideError,
  type SlideRecord,
} from "@/domain/slides/commands";

export interface SlideRepository {
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

export function createSlideService(repository: SlideRepository) {
  return {
    create(scope: ChurchScope, input: unknown) {
      return repository.create(scope, parseSlideInput(input));
    },
    async get(scope: ChurchScope, id: unknown) {
      const slide = await repository.find(scope, parseSlideId(id));
      if (!slide) throw new SlideError("SLIDE_NOT_FOUND");
      return slide;
    },
    update(scope: ChurchScope, id: unknown, value: unknown) {
      const input = parseSlideUpdate(value);
      return repository.update(
        scope,
        parseSlideId(id),
        input.expectedRevision,
        input.input,
      );
    },
    delete(scope: ChurchScope, id: unknown, value: unknown) {
      const input = parseSlideDeletion(value);
      return repository.delete(scope, parseSlideId(id), input.expectedRevision);
    },
  };
}
