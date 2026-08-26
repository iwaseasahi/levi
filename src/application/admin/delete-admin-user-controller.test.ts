import { describe, expect, it, vi } from "vitest";

import { AdminUserDeletionLastActiveError } from "./delete-admin-user";
import { createDeleteAdminUserController } from "./delete-admin-user-controller";

function createController(overrides: Record<string, unknown> = {}) {
  return createDeleteAdminUserController({
    deleteAdminUser: vi.fn().mockResolvedValue(undefined),
    getOperatorAccess: vi.fn().mockResolvedValue({
      adminUserId: "actor",
      status: "authorized",
    }),
    recordEvent: vi.fn(),
    ...overrides,
  });
}

describe("createDeleteAdminUserController", () => {
  it("deletes the selected administrator and records the actor and target", async () => {
    const deleteAdminUser = vi.fn().mockResolvedValue(undefined);
    const recordEvent = vi.fn();
    const result = await createController({ deleteAdminUser, recordEvent })(
      new Headers(),
      " target ",
      "request-id",
    );
    expect(deleteAdminUser).toHaveBeenCalledWith("actor", "target");
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "actor",
      outcome: "succeeded",
      requestId: "request-id",
      targetAdminUserId: "target",
    });
    expect(result).toEqual({
      message: "管理者を削除しました。",
      status: "success",
    });
  });

  it("rejects an unauthenticated request", async () => {
    const deleteAdminUser = vi.fn();
    const result = await createController({
      deleteAdminUser,
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "unauthenticated" }),
    })(new Headers(), "target");
    expect(deleteAdminUser).not.toHaveBeenCalled();
    expect(result.status).toBe("error");
  });

  it("returns a specific message when the target is the last active administrator", async () => {
    const result = await createController({
      deleteAdminUser: vi
        .fn()
        .mockRejectedValue(new AdminUserDeletionLastActiveError()),
    })(new Headers(), "target");
    expect(result).toEqual({
      message: "最後の有効な管理者は削除できません。",
      status: "error",
    });
  });
});
