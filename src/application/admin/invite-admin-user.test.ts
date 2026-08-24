import { describe, expect, it, vi } from "vitest";
import {
  AdminUserInvitationAuthorizationError,
  createAdminUserInviter,
  type InviteAdminUserStore,
} from "./invite-admin-user";

function createStore(): InviteAdminUserStore {
  return {
    canInvite: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue({
      id: "admin-2",
      loginId: "next.admin",
      name: "次の管理者",
    }),
  };
}

describe("createAdminUserInviter", () => {
  it("hashes and persists only the hash", async () => {
    const store = createStore();
    const hashPassword = vi.fn().mockResolvedValue("hashed");
    const invite = createAdminUserInviter({
      generatePassword: () => "t".repeat(24),
      hashPassword,
      runTransaction: (operation) => operation(store),
    });
    await expect(
      invite("actor", { loginId: "Next.Admin", name: "次の管理者" }),
    ).resolves.toMatchObject({
      loginId: "next.admin",
      temporaryPassword: "t".repeat(24),
    });
    expect(hashPassword).toHaveBeenCalledWith("t".repeat(24));
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: "hashed" }),
    );
    expect(JSON.stringify(vi.mocked(store.create).mock.calls)).not.toContain(
      "t".repeat(24),
    );
  });

  it("requires an active managing administrator", async () => {
    const store = createStore();
    vi.mocked(store.canInvite).mockResolvedValue(false);
    const invite = createAdminUserInviter({
      generatePassword: () => "t".repeat(24),
      hashPassword: vi.fn().mockResolvedValue("hashed"),
      runTransaction: (operation) => operation(store),
    });
    await expect(
      invite("actor", { loginId: "next.admin", name: "次の管理者" }),
    ).rejects.toBeInstanceOf(AdminUserInvitationAuthorizationError);
    expect(store.create).not.toHaveBeenCalled();
  });
});
