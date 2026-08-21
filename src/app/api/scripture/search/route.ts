import { searchScripture } from "@/application/scripture/search-scripture";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { scriptureSearchRepository } from "@/infrastructure/database/scripture-search-repository";
import { createScriptureSearchHandler } from "./controller";

export const dynamic = "force-dynamic";

const handler = createScriptureSearchHandler({
  getChurchAccess,
  search: (input) => searchScripture(scriptureSearchRepository, input),
});

export function GET(request: Request) {
  return handler(request);
}
