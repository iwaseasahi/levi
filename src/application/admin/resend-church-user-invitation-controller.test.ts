import { describe, expect, it, vi } from "vitest";
import type { OperatorAccess } from "@/application/auth/operator-access";
import { createResendChurchUserInvitationController } from "./resend-church-user-invitation-controller";
import {
  InvitationResendAuthorizationError,
  InvitationResendRateLimitError,
  InvitationResendUnavailableError,
} from "./resend-church-user-invitation";

const input = {
  churchId: "00000000-0000-4000-8000-000000000601",
  userId: "00000000-0000-4000-8000-000000000602",
};
function setup(
  access: OperatorAccess = { status: "authorized", adminUserId: "admin" },
) {
  const resendInvitation = vi.fn().mockResolvedValue(undefined);
  const recordEvent = vi.fn();
  const handle = createResendChurchUserInvitationController({
    getOperatorAccess: vi.fn().mockResolvedValue(access),
    resendInvitation,
    recordEvent,
  });
  return { handle, resendInvitation, recordEvent };
}

describe("resend invitation controller", () => {
  it.each<OperatorAccess>([
    { status: "unauthenticated" },
    { status: "forbidden", adminUserId: "user" },
  ])("rejects $status before parsing input or sending", async (access) => {
    const { handle, resendInvitation, recordEvent } = setup(access);
    expect(await handle(new Headers(), null)).toMatchObject({
      status: "error",
    });
    expect(resendInvitation).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({ outcome: "denied" });
  });
  it("rejects malformed IDs without logging untrusted input", async () => {
    const { handle, resendInvitation, recordEvent } = setup();
    expect(
      await handle(new Headers(), { ...input, userId: "invalid" }, "request"),
    ).toMatchObject({ status: "error" });
    expect(resendInvitation).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      outcome: "validation_failed",
      actorAdminUserId: "admin",
      requestId: "request",
    });
  });
  it("ignores a forged recipient and records only audit IDs", async () => {
    const { handle, resendInvitation, recordEvent } = setup();
    expect(
      await handle(
        new Headers(),
        { ...input, email: "forged@example.invalid" },
        "request",
      ),
    ).toMatchObject({
      status: "success",
      message: expect.stringContaining("3日間"),
    });
    expect(resendInvitation).toHaveBeenCalledWith(
      "admin",
      input.churchId,
      input.userId,
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
    [new InvitationResendAuthorizationError(), "denied", "再度ログイン"],
    [new InvitationResendRateLimitError(), "rate_limited", "1分"],
    [new InvitationResendUnavailableError(), "failed", "状態を確認"],
    [new Error("synthetic internal detail"), "failed", "もう一度"],
  ])("returns safe feedback for %s", async (error, outcome, message) => {
    const { handle, resendInvitation, recordEvent } = setup();
    resendInvitation.mockRejectedValue(error);
    const result = await handle(new Headers(), input);
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining(message as string),
    });
    expect(JSON.stringify(result)).not.toContain("synthetic internal detail");
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome }),
    );
  });
});
