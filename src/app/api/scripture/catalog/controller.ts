import type { ChurchAccess } from "@/application/auth/church-access";
import type { readScriptureCatalog } from "@/application/scripture/read-scripture-catalog";
import {
  parseScriptureCatalogQuery,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { noStoreJson, resolveChurchApiAccess } from "../../church-api-support";

type CatalogResult = Awaited<ReturnType<typeof readScriptureCatalog>>;

interface Dependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  readCatalog(
    query: ReturnType<typeof parseScriptureCatalogQuery>,
  ): Promise<CatalogResult>;
}

export function createScriptureCatalogHandler(dependencies: Dependencies) {
  return async function handleScriptureCatalog(request: Request) {
    const access = await resolveChurchApiAccess(
      request.headers,
      dependencies.getChurchAccess,
    );
    if ("response" in access) return access.response;

    try {
      const query = parseScriptureCatalogQuery(
        new URL(request.url).searchParams,
      );
      return noStoreJson(await dependencies.readCatalog(query), 200);
    } catch (error) {
      if (
        error instanceof ScriptureSearchError &&
        error.code === "INVALID_SEARCH_INPUT"
      )
        return noStoreJson({ error: { code: error.code } }, 400);
      return noStoreJson({ error: { code: "CATALOG_UNAVAILABLE" } }, 500);
    }
  };
}
