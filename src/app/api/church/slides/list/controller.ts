import {
  noStoreJson,
  resolveChurchApiAccess,
  type ChurchAccessResolver,
} from "@/app/api/church-api-support";
import {
  createSlideListService,
  type SlideListRepository,
} from "@/application/slides/list-slides";
import { SlideInputError } from "@/domain/slides/slide";

export function createSlideListHandler(dependencies: {
  getChurchAccess: ChurchAccessResolver;
  repository: SlideListRepository;
}) {
  const list = createSlideListService(dependencies.repository);
  return async (request: Request) => {
    try {
      const access = await resolveChurchApiAccess(
        request.headers,
        dependencies.getChurchAccess,
      );
      if ("response" in access) return access.response;
      const params = new URL(request.url).searchParams;
      if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
        throw new SlideInputError();
      return noStoreJson(await list(access.scope, Object.fromEntries(params)));
    } catch (cause) {
      const invalid = cause instanceof SlideInputError;
      return noStoreJson(
        {
          error: {
            code: invalid ? "INVALID_SLIDE_INPUT" : "SLIDE_UNAVAILABLE",
          },
        },
        invalid ? 400 : 500,
      );
    }
  };
}
