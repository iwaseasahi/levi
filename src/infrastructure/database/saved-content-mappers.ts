import type { Prisma } from "@/generated/prisma/client";
import {
  languageFromTranslationCodes,
  SavedContentError,
  type FolderSummary,
} from "@/domain/saved-content";

export const bookmarkInclude = {
  scripture: {
    include: {
      book: true,
      primaryTranslation: true,
      secondaryTranslation: true,
    },
  },
  slide: true,
} as const;

type SavedBookmarkRow = Prisma.BookmarkGetPayload<{
  include: typeof bookmarkInclude;
}>;

export function folderView(folder: {
  id: string;
  name: string;
  isPinned: boolean;
  position: number;
  lastUsedAt: Date | null;
}): FolderSummary {
  return {
    id: folder.id,
    name: folder.name,
    isPinned: folder.isPinned,
    position: folder.position,
    lastUsedAt: folder.lastUsedAt?.toISOString() ?? null,
  };
}

export function slideBookmarkView(bookmark: SavedBookmarkRow) {
  if (!bookmark.slide)
    throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
  return {
    id: bookmark.id,
    folderId: bookmark.folderId,
    position: bookmark.position,
    title: bookmark.title,
    slideId: bookmark.slide.slideId,
  };
}

export function scriptureBookmarkView(bookmark: SavedBookmarkRow) {
  const scripture = bookmark.scripture;
  if (!scripture) throw new SavedContentError("SAVED_CONTENT_CATALOG_ERROR");
  return {
    id: bookmark.id,
    folderId: bookmark.folderId,
    position: bookmark.position,
    title: bookmark.title,
    search: {
      book: scripture.book.canonicalCode,
      chapter: scripture.chapterNumber,
      startVerse: scripture.startVerse,
      endVerse: scripture.endVerse,
      language: languageFromTranslationCodes(
        scripture.primaryTranslation.code,
        scripture.secondaryTranslation?.code ?? null,
      ),
    },
  };
}

export function bookmarkView(bookmark: SavedBookmarkRow) {
  return bookmark.slide
    ? slideBookmarkView(bookmark)
    : scriptureBookmarkView(bookmark);
}
