import { describe, expect, it, vi } from "vitest";

import type { ChurchScope } from "@/application/auth/church-access";
import { SavedContentError } from "@/domain/saved-content";
import {
  createBookmark,
  createFolder,
  deleteBookmark,
  deleteFolder,
  listFolderOrder,
  listFolders,
  openBookmark,
  reorderBookmarks,
  reorderFolders,
  selectFolder,
  type SavedContentRepository,
  updateFolder,
} from "./manage-saved-content";

const scope = {
  churchId: "00000000-0000-4000-8000-000000000001",
} as ChurchScope;
const folder = {
  id: "00000000-0000-4000-8000-000000000002",
  isPinned: false,
  lastUsedAt: null,
  name: "主日礼拝",
  position: 0,
};
const bookmark = {
  folderId: folder.id,
  id: "00000000-0000-4000-8000-000000000003",
  position: 0,
  search: {
    book: "GEN",
    chapter: 1,
    endVerse: 2,
    language: "both" as const,
    startVerse: 1,
  },
  title: "創世記/Genesis 1:1-2",
};

function repository(): SavedContentRepository {
  return {
    createBookmark: vi.fn().mockResolvedValue(bookmark),
    createFolder: vi.fn().mockResolvedValue(folder),
    deleteBookmark: vi.fn().mockResolvedValue(true),
    deleteFolder: vi.fn().mockResolvedValue(true),
    listFolderOrder: vi.fn().mockResolvedValue([folder.id]),
    listFolders: vi.fn().mockResolvedValue([folder]),
    openBookmark: vi.fn().mockResolvedValue(bookmark),
    reorderBookmarks: vi.fn().mockResolvedValue(true),
    reorderFolders: vi.fn().mockResolvedValue(true),
    selectFolder: vi.fn().mockResolvedValue({ bookmarks: [bookmark], folder }),
    updateFolder: vi.fn().mockResolvedValue(folder),
  };
}

describe("saved content use cases", () => {
  it("delegates every successful command with the server-derived church scope", async () => {
    const saved = repository();
    const bookmarkInput = { ...bookmark.search, title: bookmark.title };

    await expect(listFolders(saved, scope)).resolves.toEqual([folder]);
    await expect(listFolderOrder(saved, scope)).resolves.toEqual([folder.id]);
    await expect(createFolder(saved, scope, folder.name)).resolves.toBe(folder);
    await expect(
      updateFolder(saved, scope, folder.id, { isPinned: true }),
    ).resolves.toBe(folder);
    await expect(selectFolder(saved, scope, folder.id)).resolves.toEqual({
      bookmarks: [bookmark],
      folder,
    });
    await expect(
      createBookmark(saved, scope, folder.id, bookmarkInput),
    ).resolves.toBe(bookmark);
    await expect(openBookmark(saved, scope, bookmark.id)).resolves.toBe(
      bookmark,
    );
    await expect(
      reorderFolders(saved, scope, [folder.id]),
    ).resolves.toBeUndefined();
    await expect(
      reorderBookmarks(saved, scope, folder.id, [bookmark.id]),
    ).resolves.toBeUndefined();
    await expect(deleteBookmark(saved, scope, bookmark.id)).resolves.toBe(
      undefined,
    );
    await expect(deleteFolder(saved, scope, folder.id)).resolves.toBe(
      undefined,
    );

    expect(saved.createBookmark).toHaveBeenCalledWith(
      scope,
      folder.id,
      bookmarkInput,
    );
  });

  it("maps missing records and ordering conflicts to stable domain errors", async () => {
    const missing = repository();
    vi.mocked(missing.createFolder).mockResolvedValue(null);
    vi.mocked(missing.updateFolder).mockResolvedValue(null);
    vi.mocked(missing.selectFolder).mockResolvedValue(null);
    vi.mocked(missing.createBookmark).mockResolvedValue(null);
    vi.mocked(missing.openBookmark).mockResolvedValue(null);
    vi.mocked(missing.reorderFolders).mockResolvedValue(false);
    vi.mocked(missing.reorderBookmarks).mockResolvedValue(false);
    vi.mocked(missing.deleteFolder).mockResolvedValue(false);
    vi.mocked(missing.deleteBookmark).mockResolvedValue(false);

    const missingCalls = [
      () => createFolder(missing, scope, folder.name),
      () => updateFolder(missing, scope, folder.id, {}),
      () => selectFolder(missing, scope, folder.id),
      () =>
        createBookmark(missing, scope, folder.id, {
          ...bookmark.search,
          title: bookmark.title,
        }),
      () => openBookmark(missing, scope, bookmark.id),
      () => deleteFolder(missing, scope, folder.id),
      () => deleteBookmark(missing, scope, bookmark.id),
    ];
    for (const call of missingCalls) {
      await expect(call()).rejects.toMatchObject({
        code: "SAVED_CONTENT_NOT_FOUND",
      } satisfies Partial<SavedContentError>);
    }
    await expect(
      reorderFolders(missing, scope, [folder.id]),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_CONFLICT" });
    await expect(
      reorderBookmarks(missing, scope, folder.id, [bookmark.id]),
    ).rejects.toMatchObject({ code: "SAVED_CONTENT_CONFLICT" });
  });
});
