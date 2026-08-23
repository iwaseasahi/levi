import type { ChurchAccess } from "@/application/auth/church-access";
import type { searchScripture } from "@/application/scripture/search-scripture";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { churchAccessFailure, noStoreJson } from "../controller-support";

type SearchResult = Awaited<ReturnType<typeof searchScripture>>;

interface ScriptureSearchHandlerDependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  search(input: ReturnType<typeof parseScriptureSearch>): Promise<SearchResult>;
}

function domainError(error: ScriptureSearchError) {
  const status =
    error.code === "INVALID_SEARCH_INPUT" ||
    error.code === "INVALID_VERSE_RANGE"
      ? 400
      : error.code === "CATALOG_INTEGRITY_ERROR"
        ? 500
        : error.code === "TRANSLATION_NOT_AVAILABLE"
          ? 409
          : 404;
  return noStoreJson({ error: { code: error.code } }, status);
}

export function createScriptureSearchHandler(
  dependencies: ScriptureSearchHandlerDependencies,
) {
  return async function handleScriptureSearch(request: Request) {
    const accessFailure = await churchAccessFailure(
      request.headers,
      dependencies.getChurchAccess,
    );
    if (accessFailure) return accessFailure;

    try {
      const input = parseScriptureSearch(new URL(request.url).searchParams);
      return noStoreJson(await dependencies.search(input), 200);
    } catch (error) {
      return error instanceof ScriptureSearchError
        ? domainError(error)
        : noStoreJson({ error: { code: "SEARCH_UNAVAILABLE" } }, 500);
    }
  };
}
