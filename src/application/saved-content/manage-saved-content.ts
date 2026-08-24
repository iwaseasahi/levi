import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import type { ChurchScope } from "@/application/auth/church-access";
import { SavedContentError } from "@/domain/saved-content";
import type { ScriptureLanguage } from "@/domain/scripture/search";

export type SavedContentRepository = {
  listFolders(scope: ChurchScope): Promise<FolderSummary[]>;
  listFolderOrder(scope: ChurchScope): Promise<string[]>;
  createFolder(scope: ChurchScope, name: string): Promise<FolderSummary | null>;
  updateFolder(
    scope: ChurchScope,
    folderId: string,
    input: { name?: string; isPinned?: boolean },
  ): Promise<FolderSummary | null>;
  selectFolder(
    scope: ChurchScope,
    folderId: string,
  ): Promise<{
    folder: FolderSummary;
    bookmarks: ScriptureBookmarkView[];
  } | null>;
  reorderFolders(scope: ChurchScope, ids: string[]): Promise<boolean>;
  deleteFolder(scope: ChurchScope, folderId: string): Promise<boolean>;
  createBookmark(
    scope: ChurchScope,
    folderId: string,
    input: {
      title: string;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number | null;
      language: ScriptureLanguage;
    },
  ): Promise<ScriptureBookmarkView | null>;
  openBookmark(
    scope: ChurchScope,
    bookmarkId: string,
  ): Promise<ScriptureBookmarkView | null>;
  reorderBookmarks(
    scope: ChurchScope,
    folderId: string,
    ids: string[],
  ): Promise<boolean>;
  deleteBookmark(scope: ChurchScope, bookmarkId: string): Promise<boolean>;
};

function found<T>(value: T | null): T {
  if (value === null) throw new SavedContentError("SAVED_CONTENT_NOT_FOUND");
  return value;
}

function completed(value: boolean) {
  if (!value) throw new SavedContentError("SAVED_CONTENT_CONFLICT");
}

export const listFolders = (
  repository: SavedContentRepository,
  scope: ChurchScope,
) => repository.listFolders(scope);

export const listFolderOrder = (
  repository: SavedContentRepository,
  scope: ChurchScope,
) => repository.listFolderOrder(scope);

export async function createFolder(
  repository: SavedContentRepository,
  scope: ChurchScope,
  name: string,
) {
  return found(await repository.createFolder(scope, name));
}

export async function updateFolder(
  repository: SavedContentRepository,
  scope: ChurchScope,
  folderId: string,
  input: { name?: string; isPinned?: boolean },
) {
  return found(await repository.updateFolder(scope, folderId, input));
}

export async function selectFolder(
  repository: SavedContentRepository,
  scope: ChurchScope,
  folderId: string,
) {
  return found(await repository.selectFolder(scope, folderId));
}

export async function reorderFolders(
  repository: SavedContentRepository,
  scope: ChurchScope,
  ids: string[],
) {
  completed(await repository.reorderFolders(scope, ids));
}

export async function deleteFolder(
  repository: SavedContentRepository,
  scope: ChurchScope,
  folderId: string,
) {
  if (!(await repository.deleteFolder(scope, folderId)))
    throw new SavedContentError("SAVED_CONTENT_NOT_FOUND");
}

export async function createBookmark(
  repository: SavedContentRepository,
  scope: ChurchScope,
  folderId: string,
  input: Parameters<SavedContentRepository["createBookmark"]>[2],
) {
  return found(await repository.createBookmark(scope, folderId, input));
}

export async function openBookmark(
  repository: SavedContentRepository,
  scope: ChurchScope,
  bookmarkId: string,
) {
  return found(await repository.openBookmark(scope, bookmarkId));
}

export async function reorderBookmarks(
  repository: SavedContentRepository,
  scope: ChurchScope,
  folderId: string,
  ids: string[],
) {
  completed(await repository.reorderBookmarks(scope, folderId, ids));
}

export async function deleteBookmark(
  repository: SavedContentRepository,
  scope: ChurchScope,
  bookmarkId: string,
) {
  if (!(await repository.deleteBookmark(scope, bookmarkId)))
    throw new SavedContentError("SAVED_CONTENT_NOT_FOUND");
}
