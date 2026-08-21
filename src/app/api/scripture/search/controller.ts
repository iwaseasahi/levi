import type { ChurchAccess } from "@/application/auth/church-access";
import type { searchScripture } from "@/application/scripture/search-scripture";
import {
  parseScriptureSearch,
  ScriptureSearchError,
} from "@/domain/scripture/search";

type SearchResult = Awaited<ReturnType<typeof searchScripture>>;

interface ScriptureSearchHandlerDependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  search(input: ReturnType<typeof parseScriptureSearch>): Promise<SearchResult>;
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
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
  return json({ error: { code: error.code } }, status);
}

export function createScriptureSearchHandler(
  dependencies: ScriptureSearchHandlerDependencies,
) {
  return async function handleScriptureSearch(request: Request) {
    const access = await dependencies.getChurchAccess(request.headers);
    if (access.status === "unauthenticated")
      return json({ error: { code: "UNAUTHENTICATED" } }, 401);
    if (access.status !== "authorized" || access.mustChangePassword)
      return json({ error: { code: "FORBIDDEN" } }, 403);

    try {
      const input = parseScriptureSearch(new URL(request.url).searchParams);
      return json(await dependencies.search(input), 200);
    } catch (error) {
      return error instanceof ScriptureSearchError
        ? domainError(error)
        : json({ error: { code: "SEARCH_UNAVAILABLE" } }, 500);
    }
  };
}
