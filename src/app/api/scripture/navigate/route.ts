import { navigateScripture } from "@/application/scripture/navigate-scripture";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { scriptureNavigationRepository } from "@/infrastructure/database/scripture-navigation-repository";
import { createScriptureNavigationHandler } from "./controller";

export const dynamic = "force-dynamic";

export const GET = createScriptureNavigationHandler({
  getChurchAccess,
  navigate: (input) => navigateScripture(scriptureNavigationRepository, input),
});
