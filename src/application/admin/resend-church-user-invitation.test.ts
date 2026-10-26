import { describe, expect, it, vi } from "vitest";
import {
  createChurchUserInvitationResender,
  InvitationResendAuthorizationError,
  InvitationResendRateLimitError,
  InvitationResendUnavailableError,
  type InvitationResendStore,
} from "./resend-church-user-invitation";

function setup() {
  const store: InvitationResendStore = {
    canManage: vi.fn().mockResolvedValue(true),
    findPendingRecipient: vi.fn().mockResolvedValue("invited@example.invalid"),
    consumeResend: vi.fn().mockResolvedValue(true),
    replaceInvitation: vi.fn().mockResolvedValue(undefined),
  };
  const resend = createChurchUserInvitationResender({
    runTransaction: (fn) => fn(store),
  });
  return { store, resend };
}

describe("church invitation resend", () => {
  it("uses only the stored recipient and leaves identity creation to the existing invitation", async () => {
    const { store, resend } = setup();
    await resend("admin", "church", "user");
    expect(store.canManage).toHaveBeenCalledWith("admin");
    expect(store.findPendingRecipient).toHaveBeenCalledWith("church", "user");
    expect(store.replaceInvitation).toHaveBeenCalledWith(
      "user",
      "invited@example.invalid",
    );
  });
  it.each([
    ["canManage", false, InvitationResendAuthorizationError],
    ["findPendingRecipient", null, InvitationResendUnavailableError],
    ["consumeResend", false, InvitationResendRateLimitError],
  ] as const)("stops on rejected %s", async (method, value, error) => {
    const { store, resend } = setup();
    vi.mocked(store[method]).mockResolvedValue(value as never);
    await expect(resend("admin", "church", "user")).rejects.toBeInstanceOf(
      error,
    );
    expect(store.replaceInvitation).not.toHaveBeenCalled();
  });
  it("propagates delivery failure for transaction rollback", async () => {
    const { store, resend } = setup();
    vi.mocked(store.replaceInvitation).mockRejectedValue(
      new Error("synthetic failure"),
    );
    await expect(resend("admin", "church", "user")).rejects.toThrow(
      "synthetic failure",
    );
  });
});
