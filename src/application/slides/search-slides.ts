import type { ChurchScope } from "@/application/auth/church-access";
import {
  parseSlideSearch,
  slideSearchResult,
  type SlideSearch,
  type SlideSummary,
} from "@/domain/slides/search";

export interface SlideSearchRepository {
  search(scope: ChurchScope, search: SlideSearch): Promise<SlideSummary[]>;
}

export function createSlideSearchService(repository: SlideSearchRepository) {
  return async (scope: ChurchScope, input: unknown) => {
    const search = parseSlideSearch(input);
    return slideSearchResult(search, await repository.search(scope, search));
  };
}
