import { describe, expect, it, vi } from "vitest";
import { AdminUserInvitationDuplicateError } from "./invite-admin-user";
import { createInviteAdminUserController } from "./invite-admin-user-controller";

const input = { loginId: "next.admin", name: "次の管理者" };

describe("createInviteAdminUserController", () => {
  it("reauthenticates before mutation", async () => {
    const inviteAdminUser = vi.fn();
    const controller = createInviteAdminUserController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "unauthenticated" }),
      inviteAdminUser,
      recordEvent: vi.fn(),
    });
    await expect(controller(new Headers(), input)).resolves.toMatchObject({
      status: "not-authorized",
    });
    expect(inviteAdminUser).not.toHaveBeenCalled();
  });

  it("returns the one-time credential after success", async () => {
    const controller = createInviteAdminUserController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "authorized", adminUserId: "actor" }),
      inviteAdminUser: vi.fn().mockResolvedValue({
        adminUserId: "admin-2",
        ...input,
        temporaryPassword: "t".repeat(24),
      }),
      recordEvent: vi.fn(),
    });
    await expect(controller(new Headers(), input)).resolves.toEqual({
      ...input,
      message: "管理者を招待しました。",
      status: "success",
      temporaryPassword: "t".repeat(24),
    });
  });

  it("returns a duplicate-safe message", async () => {
    const controller = createInviteAdminUserController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "authorized", adminUserId: "actor" }),
      inviteAdminUser: vi
        .fn()
        .mockRejectedValue(new AdminUserInvitationDuplicateError()),
      recordEvent: vi.fn(),
    });
    await expect(controller(new Headers(), input)).resolves.toEqual({
      message: "このログインIDは既に使用されています。",
      status: "server-error",
    });
  });
});
