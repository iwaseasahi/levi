import type { ChurchScope } from "@/application/auth/church-access";
import {
  parseSlideListQuery,
  slideListResult,
  type SlideListQuery,
  type SlideSummary,
} from "@/domain/slides/list";

export interface SlideListRepository {
  list(scope: ChurchScope, query: SlideListQuery): Promise<SlideSummary[]>;
}

export function createSlideListService(repository: SlideListRepository) {
  return async (scope: ChurchScope, input: unknown) => {
    const query = parseSlideListQuery(input);
    return slideListResult(query, await repository.list(scope, query));
  };
}
