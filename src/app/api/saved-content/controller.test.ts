import { describe, expect, it, vi } from "vitest";
import type { ChurchScope } from "@/application/auth/church-access";
import type { SavedContentRepository } from "@/application/saved-content/manage-saved-content";
import { createSavedContentHandlers } from "./controller";

const churchId = "00000000-0000-4000-8000-000000000054";
const folderId = "00000000-0000-4000-8000-000000000055";
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
    updateFolder: vi.fn(),
    selectFolder: vi.fn().mockResolvedValue({ folder: {}, bookmarks: [] }),
    reorderFolders: vi.fn().mockResolvedValue(true),
    deleteFolder: vi.fn().mockResolvedValue(true),
    createBookmark: vi.fn(),
    openBookmark: vi.fn(),
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
