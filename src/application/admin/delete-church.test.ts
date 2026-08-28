import { describe, expect, it, vi } from "vitest";

import {
  ChurchDeletionAuthorizationError,
  ChurchDeletionConfirmationError,
  ChurchDeletionFailedError,
  ChurchDeletionNotFoundError,
  createChurchDeleter,
  type DeleteChurchStore,
} from "./delete-church";

function createStore(
  overrides: Partial<DeleteChurchStore> = {},
): DeleteChurchStore {
  return {
    canDelete: vi.fn().mockResolvedValue(true),
    deleteChurch: vi.fn().mockResolvedValue(undefined),
    deleteUsers: vi.fn().mockResolvedValue(undefined),
    deleteUserVerifications: vi.fn().mockResolvedValue(undefined),
    findTarget: vi.fn().mockResolvedValue({
      name: "第一教会",
      userIds: ["user-1", "user-2"],
    }),
    ...overrides,
  };
}

function deleter(store: DeleteChurchStore) {
  return createChurchDeleter({
    runTransaction: (operation) => operation(store),
  });
}

describe("createChurchDeleter", () => {
  it("deletes the church aggregate and every member's auth state in one transaction", async () => {
    const store = createStore();

    await deleter(store)("admin-1", "church-1", "第一教会");

    expect(store.deleteChurch).toHaveBeenCalledWith("church-1");
    expect(store.deleteUserVerifications).toHaveBeenCalledWith([
      "user-1",
      "user-2",
    ]);
    expect(store.deleteUsers).toHaveBeenCalledWith(["user-1", "user-2"]);
    expect(
      vi.mocked(store.deleteChurch).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(store.deleteUsers).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not issue empty user deletion queries", async () => {
    const store = createStore({
      findTarget: vi.fn().mockResolvedValue({
        name: "利用者なし教会",
        userIds: [],
      }),
    });

    await deleter(store)("admin-1", "church-1", "利用者なし教会");

    expect(store.deleteChurch).toHaveBeenCalledWith("church-1");
    expect(store.deleteUserVerifications).not.toHaveBeenCalled();
    expect(store.deleteUsers).not.toHaveBeenCalled();
  });

  it.each([
    [
      "unauthorized actor",
      { canDelete: vi.fn().mockResolvedValue(false) },
      "第一教会",
      ChurchDeletionAuthorizationError,
    ],
    [
      "missing church",
      { findTarget: vi.fn().mockResolvedValue(null) },
      "第一教会",
      ChurchDeletionNotFoundError,
    ],
    [
      "mismatched confirmation",
      {},
      "別の教会",
      ChurchDeletionConfirmationError,
    ],
  ])("rejects %s", async (_label, overrides, confirmation, ErrorType) => {
    const store = createStore(overrides as Partial<DeleteChurchStore>);

    await expect(
      deleter(store)("admin-1", "church-1", confirmation),
    ).rejects.toBeInstanceOf(ErrorType);
    expect(store.deleteChurch).not.toHaveBeenCalled();
    expect(store.deleteUsers).not.toHaveBeenCalled();
  });

  it("maps unexpected persistence errors without leaking their details", async () => {
    const store = createStore({
      deleteChurch: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });

    await expect(
      deleter(store)("admin-1", "church-1", "第一教会"),
    ).rejects.toBeInstanceOf(ChurchDeletionFailedError);
  });
});
