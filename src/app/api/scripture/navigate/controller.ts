import type { ChurchAccess } from "@/application/auth/church-access";
import type { navigateScripture } from "@/application/scripture/navigate-scripture";
import { parseScriptureNavigation } from "@/domain/scripture/navigation";
import { ScriptureSearchError } from "@/domain/scripture/search";
import { noStoreJson, resolveChurchApiAccess } from "../../church-api-support";

type Result = Awaited<ReturnType<typeof navigateScripture>>;

interface Dependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  navigate(input: ReturnType<typeof parseScriptureNavigation>): Promise<Result>;
}

function domainError(error: ScriptureSearchError) {
  const status =
    error.code === "INVALID_SEARCH_INPUT"
      ? 400
      : error.code === "CATALOG_INTEGRITY_ERROR"
        ? 500
        : error.code === "TRANSLATION_NOT_AVAILABLE"
          ? 409
          : 404;
  return noStoreJson({ error: { code: error.code } }, status);
}

export function createScriptureNavigationHandler(dependencies: Dependencies) {
  return async function handleNavigation(request: Request) {
    const access = await resolveChurchApiAccess(
      request.headers,
      dependencies.getChurchAccess,
    );
    if ("response" in access) return access.response;
    try {
      const input = parseScriptureNavigation(new URL(request.url).searchParams);
      return noStoreJson(await dependencies.navigate(input), 200);
    } catch (error) {
      return error instanceof ScriptureSearchError
        ? domainError(error)
        : noStoreJson({ error: { code: "NAVIGATION_UNAVAILABLE" } }, 500);
    }
  };
}
