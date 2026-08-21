import type {
  ScriptureCatalog,
  ScriptureCatalogQuery,
} from "@/domain/scripture/search";

export interface ScriptureCatalogRepository {
  read(query: ScriptureCatalogQuery): Promise<ScriptureCatalog>;
}

export function readScriptureCatalog(
  repository: ScriptureCatalogRepository,
  query: ScriptureCatalogQuery,
) {
  return repository.read(query);
}
