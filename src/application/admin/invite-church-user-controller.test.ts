import { describe, expect, it, vi } from "vitest";

import { ChurchUserInvitationFailedError } from "./invite-church-user";
import { createInviteChurchUserController } from "./invite-church-user-controller";

const churchId = "00000000-0000-4000-8000-000000000002";
const validInput = {
  accountName: "追加利用者",
  churchId,
  email: "second@example.invalid",
};

describe("createInviteChurchUserController", () => {
  it("denies before validating or mutating", async () => {
    const inviteChurchUser = vi.fn();
    const recordEvent = vi.fn();
    const controller = createInviteChurchUserController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "unauthenticated" }),
      inviteChurchUser,
      recordEvent,
    });

    await expect(
      controller(new Headers(), { ...validInput, email: "invalid" }, "req-1"),
    ).resolves.toMatchObject({ status: "not-authorized" });
    expect(inviteChurchUser).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      outcome: "denied",
      requestId: "req-1",
    });
  });

  it("returns field errors without invoking the use case", async () => {
    const inviteChurchUser = vi.fn();
    const controller = createInviteChurchUserController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      inviteChurchUser,
      recordEvent: vi.fn(),
    });

    await expect(
      controller(new Headers(), { ...validInput, accountName: " " }),
    ).resolves.toMatchObject({
      fieldErrors: { accountName: ["利用者名を入力してください。"] },
      status: "validation-error",
    });
    expect(inviteChurchUser).not.toHaveBeenCalled();
  });

  it("returns a safe success DTO and audits both targets", async () => {
    const recordEvent = vi.fn();
    const controller = createInviteChurchUserController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      inviteChurchUser: vi.fn().mockResolvedValue({
        churchId,
        churchName: "テスト教会",
        email: validInput.email,
        userId: "user-id",
      }),
      recordEvent,
    });

    await expect(
      controller(new Headers(), validInput, "req-2"),
    ).resolves.toEqual({
      churchName: "テスト教会",
      email: validInput.email,
      message: "教会利用者へ招待メールを送信しました。",
      status: "success",
    });
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "operator-id",
      outcome: "succeeded",
      requestId: "req-2",
      targetChurchId: churchId,
      targetUserId: "user-id",
    });
  });

  it("does not reveal whether a church or email exists on failure", async () => {
    const controller = createInviteChurchUserController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      inviteChurchUser: vi
        .fn()
        .mockRejectedValue(new ChurchUserInvitationFailedError()),
      recordEvent: vi.fn(),
    });

    const result = await controller(new Headers(), validInput);
    expect(result).toMatchObject({ status: "server-error" });
    expect(JSON.stringify(result)).not.toContain(validInput.email);
  });
});
