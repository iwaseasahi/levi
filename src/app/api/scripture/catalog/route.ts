import { readScriptureCatalog } from "@/application/scripture/read-scripture-catalog";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { scriptureCatalogRepository } from "@/infrastructure/database/scripture-catalog-repository";
import { createScriptureCatalogHandler } from "./controller";

export const GET = createScriptureCatalogHandler({
  getChurchAccess,
  readCatalog: (query) =>
    readScriptureCatalog(scriptureCatalogRepository, query),
});
