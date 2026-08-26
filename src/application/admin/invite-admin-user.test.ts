import { describe, expect, it, vi } from "vitest";
import {
  AdminUserInvitationAuthorizationError,
  AdminUserInvitationFailedError,
  createAdminUserInviter,
  type InviteAdminUserStore,
} from "./invite-admin-user";

function createStore(): InviteAdminUserStore {
  return {
    canInvite: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue({
      email: "next.admin@example.com",
      id: "admin-2",
      loginId: "next.admin",
      name: "次の管理者",
    }),
  };
}

describe("createAdminUserInviter", () => {
  it("stores a bootstrap credential and sends the invitation by email", async () => {
    const store = createStore();
    const hashPassword = vi.fn().mockResolvedValue("hashed");
    const sendInvitation = vi.fn().mockResolvedValue(undefined);
    const invite = createAdminUserInviter({
      generatePassword: () => "t".repeat(24),
      hashPassword,
      removeUnsentInvitation: vi.fn(),
      sendInvitation,
      runTransaction: (operation) => operation(store),
    });
    await expect(
      invite("actor", {
        email: "next.admin@example.com",
        loginId: "Next.Admin",
        name: "次の管理者",
      }),
    ).resolves.toMatchObject({
      email: "next.admin@example.com",
      loginId: "next.admin",
    });
    expect(hashPassword).toHaveBeenCalledWith("t".repeat(24));
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed" }),
    );
    expect(JSON.stringify(vi.mocked(store.create).mock.calls)).not.toContain(
      "t".repeat(24),
    );
    expect(sendInvitation).toHaveBeenCalledWith("next.admin@example.com");
  });

  it("requires an active managing administrator", async () => {
    const store = createStore();
    vi.mocked(store.canInvite).mockResolvedValue(false);
    const invite = createAdminUserInviter({
      generatePassword: () => "t".repeat(24),
      hashPassword: vi.fn().mockResolvedValue("hashed"),
      removeUnsentInvitation: vi.fn(),
      sendInvitation: vi.fn(),
      runTransaction: (operation) => operation(store),
    });
    await expect(
      invite("actor", {
        email: "next.admin@example.com",
        loginId: "next.admin",
        name: "次の管理者",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationAuthorizationError);
    expect(store.create).not.toHaveBeenCalled();
  });

  it("removes an unusable invitation when email delivery fails", async () => {
    const store = createStore();
    const removeUnsentInvitation = vi.fn().mockResolvedValue(undefined);
    const invite = createAdminUserInviter({
      generatePassword: () => "t".repeat(24),
      hashPassword: vi.fn().mockResolvedValue("hashed"),
      removeUnsentInvitation,
      sendInvitation: vi.fn().mockRejectedValue(new Error("SMTP unavailable")),
      runTransaction: (operation) => operation(store),
    });

    await expect(
      invite("actor", {
        email: "next.admin@example.com",
        loginId: "next.admin",
        name: "次の管理者",
      }),
    ).rejects.toBeInstanceOf(AdminUserInvitationFailedError);
    expect(removeUnsentInvitation).toHaveBeenCalledWith("admin-2");
  });
});
