import { describe, expect, it, vi } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import type { SavedContentRepository } from "@/application/saved-content/manage-saved-content";
import { createSavedContentHandlers } from "./controller";

const churchId = "00000000-0000-4000-8000-000000000054";
const folderId = "00000000-0000-4000-8000-000000000055";
const bookmarkId = "00000000-0000-4000-8000-000000000056";
const slideId = "00000000-0000-4000-8000-000000000057";
const scope = { churchId } as ChurchScope;
const authorized = {
  mustChangePassword: false,
  scope,
  status: "authorized" as const,
  userId: "user-id",
};

function repository(): SavedContentRepository {
  return {
    listFolders: vi.fn().mockResolvedValue([]),
    listFolderOrder: vi.fn().mockResolvedValue([]),
    createFolder: vi.fn().mockResolvedValue({
      id: folderId,
      name: "礼拝",
      isPinned: false,
      position: 0,
      lastUsedAt: null,
    }),
    updateFolder: vi.fn().mockResolvedValue({
      id: folderId,
      name: "更新後",
      isPinned: true,
      position: 0,
      lastUsedAt: null,
    }),
    selectFolder: vi.fn().mockResolvedValue({ folder: {}, bookmarks: [] }),
    reorderFolders: vi.fn().mockResolvedValue(true),
    deleteFolder: vi.fn().mockResolvedValue(true),
    createBookmark: vi.fn().mockResolvedValue({
      id: bookmarkId,
      folderId,
      position: 0,
      title: "創世記 1:1",
      search: {
        book: "GEN",
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        language: "both",
      },
    }),
    createSlideBookmark: vi.fn().mockResolvedValue({
      id: bookmarkId,
      folderId,
      position: 0,
      title: "Synthetic slide",
      slideId,
    }),
    openBookmark: vi.fn().mockResolvedValue({
      id: bookmarkId,
      folderId,
      position: 0,
      title: "創世記 1:1",
      search: {
        book: "GEN",
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        language: "both",
      },
    }),
    reorderBookmarks: vi.fn().mockResolvedValue(true),
    deleteBookmark: vi.fn().mockResolvedValue(true),
  };
}

describe("saved content HTTP handlers", () => {
  it("lists only with the server-derived church", async () => {
    const saved = repository();
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      repository: saved,
    });
    const response = await handlers.GET(
      new Request("https://levi.example/api/saved-content"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(saved.listFolders).toHaveBeenCalledWith(scope);
    expect(saved.listFolderOrder).toHaveBeenCalledWith(scope);
  });

  it("creates a strict folder command", async () => {
    const saved = repository();
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      repository: saved,
    });
    const response = await handlers.POST(
      new Request("https://levi.example/api/saved-content", {
        method: "POST",
        body: JSON.stringify({ action: "create-folder", name: "  礼拝  " }),
      }),
    );
    expect(response.status).toBe(200);
    expect(saved.createFolder).toHaveBeenCalledWith(scope, "礼拝");
  });

  it.each([
    [
      "create-slide-bookmark",
      { action: "create-slide-bookmark", folderId, slideId },
      "createSlideBookmark",
      [scope, folderId, slideId],
      { bookmark: expect.objectContaining({ id: bookmarkId, slideId }) },
    ],
    [
      "update-folder",
      { action: "update-folder", folderId, name: " 更新後 ", isPinned: true },
      "updateFolder",
      [scope, folderId, { name: "更新後", isPinned: true }],
      { folder: expect.objectContaining({ id: folderId, name: "更新後" }) },
    ],
    [
      "reorder-folders",
      { action: "reorder-folders", ids: [folderId] },
      "reorderFolders",
      [scope, [folderId]],
      { ok: true },
    ],
    [
      "delete-folder",
      { action: "delete-folder", folderId },
      "deleteFolder",
      [scope, folderId],
      { ok: true },
    ],
    [
      "create-bookmark",
      {
        action: "create-bookmark",
        folderId,
        title: " 創世記 1:1 ",
        book: "GEN",
        chapter: 1,
        startVerse: 1,
        endVerse: 1,
        language: "both",
      },
      "createBookmark",
      [
        scope,
        folderId,
        {
          title: "創世記 1:1",
          book: "GEN",
          chapter: 1,
          startVerse: 1,
          endVerse: 1,
          language: "both",
        },
      ],
      { bookmark: expect.objectContaining({ id: bookmarkId }) },
    ],
    [
      "open-bookmark",
      { action: "open-bookmark", bookmarkId },
      "openBookmark",
      [scope, bookmarkId],
      { bookmark: expect.objectContaining({ id: bookmarkId }) },
    ],
    [
      "reorder-bookmarks",
      { action: "reorder-bookmarks", folderId, ids: [bookmarkId] },
      "reorderBookmarks",
      [scope, folderId, [bookmarkId]],
      { ok: true },
    ],
    [
      "delete-bookmark",
      { action: "delete-bookmark", bookmarkId },
      "deleteBookmark",
      [scope, bookmarkId],
      { ok: true },
    ],
  ] as const)(
    "dispatches the %s command with the server-derived scope",
    async (_action, body, method, expectedArguments, expectedBody) => {
      const saved = repository();
      const handlers = createSavedContentHandlers({
        getChurchAccess: vi.fn().mockResolvedValue(authorized),
        repository: saved,
      });

      const response = await handlers.POST(
        new Request("https://levi.example/api/saved-content", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );

      expect(response.status).toBe(200);
      expect(saved[method]).toHaveBeenCalledWith(...expectedArguments);
      await expect(response.json()).resolves.toEqual(expectedBody);
    },
  );

  it("never accepts a church ID from the command", async () => {
    const saved = repository();
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      repository: saved,
    });
    const response = await handlers.POST(
      new Request("https://levi.example/api/saved-content", {
        method: "POST",
        body: JSON.stringify({
          action: "create-folder",
          churchId: "00000000-0000-4000-8000-000000000099",
          name: "Foreign",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(saved.createFolder).not.toHaveBeenCalled();
  });

  it("rejects the removed bookmark update command", async () => {
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      repository: repository(),
    });
    const response = await handlers.POST(
      new Request("https://levi.example/api/saved-content", {
        method: "POST",
        body: JSON.stringify({
          action: "update-bookmark",
          bookmarkId: "00000000-0000-4000-8000-000000000056",
          title: "変更後",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it.each([
    [{ status: "unauthenticated" }, 401],
    [{ status: "forbidden", userId: "user-id" }, 403],
    [{ ...authorized, mustChangePassword: true }, 403],
  ] as const)("rejects ineligible access", async (access, status) => {
    const saved = repository();
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(access),
      repository: saved,
    });
    expect(
      (
        await handlers.GET(
          new Request("https://levi.example/api/saved-content"),
        )
      ).status,
    ).toBe(status);
    expect(saved.listFolders).not.toHaveBeenCalled();
  });

  it("rejects unknown and repeated query fields", async () => {
    const handlers = createSavedContentHandlers({
      getChurchAccess: vi.fn().mockResolvedValue(authorized),
      repository: repository(),
    });
    await expect(
      handlers.GET(
        new Request("https://levi.example/api/saved-content?churchId=foreign"),
      ),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      handlers.GET(
        new Request(
          `https://levi.example/api/saved-content?folderId=${folderId}&folderId=${folderId}`,
        ),
      ),
    ).resolves.toMatchObject({ status: 400 });
  });
});
