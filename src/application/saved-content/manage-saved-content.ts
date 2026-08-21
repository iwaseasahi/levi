import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import { SavedContentError } from "@/domain/saved-content";
import type { ScriptureLanguage } from "@/domain/scripture/search";

export type SavedContentRepository = {
  listFolders(churchId: string): Promise<FolderSummary[]>;
  createFolder(churchId: string, name: string): Promise<FolderSummary | null>;
  updateFolder(
    churchId: string,
    folderId: string,
    input: { name?: string; isPinned?: boolean },
  ): Promise<FolderSummary | null>;
  selectFolder(
    churchId: string,
    folderId: string,
  ): Promise<{
    folder: FolderSummary;
    bookmarks: ScriptureBookmarkView[];
  } | null>;
  reorderFolders(churchId: string, ids: string[]): Promise<boolean>;
  deleteFolder(churchId: string, folderId: string): Promise<boolean>;
  createBookmark(
    churchId: string,
    folderId: string,
    input: {
      title: string;
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
      language: ScriptureLanguage;
    },
  ): Promise<ScriptureBookmarkView | null>;
  openBookmark(
    churchId: string,
    bookmarkId: string,
  ): Promise<ScriptureBookmarkView | null>;
  reorderBookmarks(
    churchId: string,
    folderId: string,
    ids: string[],
  ): Promise<boolean>;
  deleteBookmark(churchId: string, bookmarkId: string): Promise<boolean>;
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
  churchId: string,
) => repository.listFolders(churchId);

export async function createFolder(
  repository: SavedContentRepository,
  churchId: string,
  name: string,
) {
  return found(await repository.createFolder(churchId, name));
}

export async function updateFolder(
  repository: SavedContentRepository,
  churchId: string,
  folderId: string,
  input: { name?: string; isPinned?: boolean },
) {
  return found(await repository.updateFolder(churchId, folderId, input));
}

export async function selectFolder(
  repository: SavedContentRepository,
  churchId: string,
  folderId: string,
) {
  return found(await repository.selectFolder(churchId, folderId));
}

export async function reorderFolders(
  repository: SavedContentRepository,
  churchId: string,
  ids: string[],
) {
  completed(await repository.reorderFolders(churchId, ids));
}

export async function deleteFolder(
  repository: SavedContentRepository,
  churchId: string,
  folderId: string,
) {
  if (!(await repository.deleteFolder(churchId, folderId)))
    throw new SavedContentError("SAVED_CONTENT_NOT_FOUND");
}

export async function createBookmark(
  repository: SavedContentRepository,
  churchId: string,
  folderId: string,
  input: Parameters<SavedContentRepository["createBookmark"]>[2],
) {
  return found(await repository.createBookmark(churchId, folderId, input));
}

export async function openBookmark(
  repository: SavedContentRepository,
  churchId: string,
  bookmarkId: string,
) {
  return found(await repository.openBookmark(churchId, bookmarkId));
}

export async function reorderBookmarks(
  repository: SavedContentRepository,
  churchId: string,
  folderId: string,
  ids: string[],
) {
  completed(await repository.reorderBookmarks(churchId, folderId, ids));
}

export async function deleteBookmark(
  repository: SavedContentRepository,
  churchId: string,
  bookmarkId: string,
) {
  if (!(await repository.deleteBookmark(churchId, bookmarkId)))
    throw new SavedContentError("SAVED_CONTENT_NOT_FOUND");
}
