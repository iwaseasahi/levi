import { describe, expect, it, vi } from "vitest";
import type { OperatorAccess } from "@/application/auth/operator-access";
import { createDeleteChurchUserController } from "./delete-church-user-controller";
import {
  ChurchUserDeletionAuthorizationError,
  ChurchUserDeletionConfirmationError,
  ChurchUserDeletionNotFoundError,
} from "./delete-church-user";

const input = {
  churchId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  confirmationEmail: "member@example.test",
};
function setup(
  access: OperatorAccess = { status: "authorized", adminUserId: "admin" },
) {
  const dependencies = {
    deleteChurchUser: vi.fn().mockResolvedValue(undefined),
    getOperatorAccess: vi.fn().mockResolvedValue(access),
    recordEvent: vi.fn(),
  };
  return {
    ...dependencies,
    handle: createDeleteChurchUserController(dependencies),
  };
}

describe("church user deletion controller", () => {
  it.each<OperatorAccess>([
    { status: "unauthenticated" },
    { status: "forbidden", adminUserId: "user" },
  ])("rejects $status", async (access) => {
    const { handle, deleteChurchUser, recordEvent } = setup(access);
    expect((await handle(new Headers(), input)).status).toBe("error");
    expect(deleteChurchUser).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({ outcome: "denied" });
  });
  it.each([
    { ...input, churchId: "private@example.test" },
    { ...input, userId: "bad" },
    { ...input, confirmationEmail: "" },
    null,
  ])("validates without logging raw input", async (raw) => {
    const { handle, deleteChurchUser, recordEvent } = setup();
    expect((await handle(new Headers(), raw)).status).toBe("error");
    expect(deleteChurchUser).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "admin",
      outcome: "validation_failed",
    });
  });
  it("normalizes confirmation and records only validated IDs and outcome", async () => {
    const { handle, deleteChurchUser, recordEvent } = setup();
    expect(
      await handle(
        new Headers(),
        { ...input, confirmationEmail: " MEMBER@example.test " },
        "request",
      ),
    ).toEqual({ status: "success", message: "利用者を削除しました。" });
    expect(deleteChurchUser).toHaveBeenCalledWith(
      "admin",
      input.churchId,
      input.userId,
      input.confirmationEmail,
    );
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "admin",
      targetChurchId: input.churchId,
      targetUserId: input.userId,
      outcome: "succeeded",
      requestId: "request",
    });
  });
  it.each([
    [new ChurchUserDeletionAuthorizationError(), "denied", "再度ログイン"],
    [
      new ChurchUserDeletionConfirmationError(),
      "validation_failed",
      "一致しません",
    ],
    [new ChurchUserDeletionNotFoundError(), "failed", "見つかりません"],
    [new Error("private detail"), "failed", "もう一度お試し"],
  ])("maps failures safely", async (error, outcome, message) => {
    const { handle, deleteChurchUser, recordEvent } = setup();
    deleteChurchUser.mockRejectedValue(error);
    expect(await handle(new Headers(), input)).toEqual({
      status: "error",
      message: expect.stringContaining(message),
    });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome }),
    );
    expect(JSON.stringify(recordEvent.mock.calls)).not.toContain(
      input.confirmationEmail,
    );
  });
});
