import { describe, expect, it, vi } from "vitest";
import { AdminUserInvitationDuplicateError } from "./invite-admin-user";
import { createInviteAdminUserController } from "./invite-admin-user-controller";

const input = {
  email: "next.admin@example.com",
  name: "次の管理者",
};

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

  it("returns the invited administrator after sending email", async () => {
    const controller = createInviteAdminUserController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "authorized", adminUserId: "actor" }),
      inviteAdminUser: vi.fn().mockResolvedValue({
        adminUserId: "admin-2",
        ...input,
      }),
      recordEvent: vi.fn(),
    });
    await expect(controller(new Headers(), input)).resolves.toEqual({
      ...input,
      message: "管理者へ招待メールを送信しました。",
      status: "success",
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
      message: "このメールアドレスは既に使用されています。",
      status: "server-error",
    });
  });
});
