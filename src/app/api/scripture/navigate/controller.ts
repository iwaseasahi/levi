import type { ChurchAccess } from "@/application/auth/church-access";
import type { navigateScripture } from "@/application/scripture/navigate-scripture";
import { parseScriptureNavigation } from "@/domain/scripture/navigation";
import { ScriptureSearchError } from "@/domain/scripture/search";

type Result = Awaited<ReturnType<typeof navigateScripture>>;

interface Dependencies {
  getChurchAccess(headers: Headers): Promise<ChurchAccess>;
  navigate(input: ReturnType<typeof parseScriptureNavigation>): Promise<Result>;
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
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
  return json({ error: { code: error.code } }, status);
}

export function createScriptureNavigationHandler(dependencies: Dependencies) {
  return async function handleNavigation(request: Request) {
    const access = await dependencies.getChurchAccess(request.headers);
    if (access.status === "unauthenticated")
      return json({ error: { code: "UNAUTHENTICATED" } }, 401);
    if (access.status !== "authorized" || access.mustChangePassword)
      return json({ error: { code: "FORBIDDEN" } }, 403);
    try {
      const input = parseScriptureNavigation(new URL(request.url).searchParams);
      return json(await dependencies.navigate(input), 200);
    } catch (error) {
      return error instanceof ScriptureSearchError
        ? domainError(error)
        : json({ error: { code: "NAVIGATION_UNAVAILABLE" } }, 500);
    }
  };
}
