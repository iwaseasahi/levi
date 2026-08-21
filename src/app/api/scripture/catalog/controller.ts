import type { ChurchAccess } from "@/application/auth/church-access";
import type { readScriptureCatalog } from "@/application/scripture/read-scripture-catalog";
import {
  parseScriptureCatalogQuery,
  ScriptureSearchError,
} from "@/domain/scripture/search";

type CatalogResult = Awaited<ReturnType<typeof readScriptureCatalog>>;

interface Dependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  readCatalog(
    query: ReturnType<typeof parseScriptureCatalogQuery>,
  ): Promise<CatalogResult>;
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export function createScriptureCatalogHandler(dependencies: Dependencies) {
  return async function handleScriptureCatalog(request: Request) {
    const access = await dependencies.getChurchAccess(request.headers);
    if (access.status === "unauthenticated")
      return json({ error: { code: "UNAUTHENTICATED" } }, 401);
    if (access.status !== "authorized" || access.mustChangePassword)
      return json({ error: { code: "FORBIDDEN" } }, 403);

    try {
      const query = parseScriptureCatalogQuery(
        new URL(request.url).searchParams,
      );
      return json(await dependencies.readCatalog(query), 200);
    } catch (error) {
      if (
        error instanceof ScriptureSearchError &&
        error.code === "INVALID_SEARCH_INPUT"
      )
        return json({ error: { code: error.code } }, 400);
      return json({ error: { code: "CATALOG_UNAVAILABLE" } }, 500);
    }
  };
}
