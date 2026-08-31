import { describe, expect, it, vi } from "vitest";
import {
  createChurchUserDeleter,
  type DeleteChurchUserStore,
  ChurchUserDeletionAuthorizationError,
  ChurchUserDeletionConfirmationError,
  ChurchUserDeletionNotFoundError,
  ChurchUserDeletionFailedError,
} from "./delete-church-user";

function setup() {
  const store = {
    canDelete: vi.fn().mockResolvedValue(true),
    findTarget: vi.fn().mockResolvedValue({ email: "member@example.test" }),
    deleteVerifications: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  } satisfies DeleteChurchUserStore;
  const runTransaction = vi.fn();
  return {
    store,
    runTransaction,
    remove: createChurchUserDeleter({
      runTransaction: async <T>(
        operation: (s: DeleteChurchUserStore) => Promise<T>,
      ) => {
        runTransaction();
        return operation(store);
      },
    }),
  };
}

describe("church user deletion", () => {
  it("authorizes and confirms the church-scoped target before deleting only its aggregate", async () => {
    const { store, remove, runTransaction } = setup();
    await remove("admin", "church", "user", " MEMBER@example.test ");
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(store.canDelete).toHaveBeenCalledWith("admin");
    expect(store.findTarget).toHaveBeenCalledWith("church", "user");
    expect(store.deleteVerifications).toHaveBeenCalledWith("user");
    expect(store.deleteUser).toHaveBeenCalledWith("user");
    expect(store.deleteVerifications.mock.invocationCallOrder[0]).toBeLessThan(
      store.deleteUser.mock.invocationCallOrder[0]!,
    );
  });

  it.each(["denied", "missing", "mismatch"])(
    "does not mutate for %s",
    async (scenario) => {
      const { store, remove } = setup();
      if (scenario === "denied") store.canDelete.mockResolvedValue(false);
      if (scenario === "missing") store.findTarget.mockResolvedValue(null);
      const error =
        scenario === "denied"
          ? ChurchUserDeletionAuthorizationError
          : scenario === "missing"
            ? ChurchUserDeletionNotFoundError
            : ChurchUserDeletionConfirmationError;
      await expect(
        remove(
          "admin",
          "church",
          "user",
          scenario === "mismatch"
            ? "other@example.test"
            : "member@example.test",
        ),
      ).rejects.toBeInstanceOf(error);
      expect(store.deleteUser).not.toHaveBeenCalled();
      expect(store.deleteVerifications).not.toHaveBeenCalled();
      if (scenario === "denied")
        expect(store.findTarget).not.toHaveBeenCalled();
    },
  );

  it("sanitizes storage errors", async () => {
    const { store, remove } = setup();
    store.deleteUser.mockRejectedValue(new Error("private database detail"));
    await expect(
      remove("admin", "church", "user", "member@example.test"),
    ).rejects.toEqual(new ChurchUserDeletionFailedError());
  });
});
