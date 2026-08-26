import { describe, expect, it, vi } from "vitest";

import {
  AdminUserDeletionAuthorizationError,
  AdminUserDeletionBootstrapError,
  AdminUserDeletionFailedError,
  AdminUserDeletionLastActiveError,
  AdminUserDeletionNotFoundError,
  AdminUserDeletionSelfError,
  createAdminUserDeleter,
  type DeleteAdminUserStore,
} from "./delete-admin-user";

function createStore(
  overrides: Partial<DeleteAdminUserStore> = {},
): DeleteAdminUserStore {
  return {
    canDelete: vi.fn().mockResolvedValue(true),
    countActive: vi.fn().mockResolvedValue(2),
    delete: vi.fn().mockResolvedValue(undefined),
    findStatus: vi.fn().mockResolvedValue("INVITED"),
    removeInviterReferences: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function deleter(store: DeleteAdminUserStore) {
  return createAdminUserDeleter({
    runTransaction: (operation) => operation(store),
  });
}

describe("createAdminUserDeleter", () => {
  it("removes invitation references before physically deleting an administrator", async () => {
    const store = createStore();
    await deleter(store)("actor", "target");
    expect(store.removeInviterReferences).toHaveBeenCalledWith("target");
    expect(store.delete).toHaveBeenCalledWith("target");
    expect(
      vi.mocked(store.removeInviterReferences).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(store.delete).mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    [
      "unauthorized actor",
      { canDelete: vi.fn().mockResolvedValue(false) },
      AdminUserDeletionAuthorizationError,
    ],
    ["self deletion", {}, AdminUserDeletionSelfError],
    [
      "missing target",
      { findStatus: vi.fn().mockResolvedValue(null) },
      AdminUserDeletionNotFoundError,
    ],
    [
      "bootstrap target",
      { findStatus: vi.fn().mockResolvedValue("BOOTSTRAP") },
      AdminUserDeletionBootstrapError,
    ],
    [
      "last active target",
      {
        countActive: vi.fn().mockResolvedValue(1),
        findStatus: vi.fn().mockResolvedValue("ACTIVE"),
      },
      AdminUserDeletionLastActiveError,
    ],
  ])("rejects %s", async (_label, overrides, ErrorType) => {
    const store = createStore(overrides as Partial<DeleteAdminUserStore>);
    const actor = _label === "self deletion" ? "target" : "actor";
    await expect(deleter(store)(actor, "target")).rejects.toBeInstanceOf(
      ErrorType,
    );
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("maps unexpected persistence errors", async () => {
    const store = createStore({
      delete: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });
    await expect(deleter(store)("actor", "target")).rejects.toBeInstanceOf(
      AdminUserDeletionFailedError,
    );
  });
});
