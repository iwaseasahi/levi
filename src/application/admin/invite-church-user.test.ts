import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ChurchUserInvitationAuthorizationError,
  ChurchUserInvitationFailedError,
  ChurchUserInvitationInputError,
  createChurchUserInviter,
  type InviteChurchUserTransaction,
} from "./invite-church-user";

const operatorId = "00000000-0000-4000-8000-000000000001";
const churchId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const input = {
  accountName: "追加利用者",
  churchId,
  email: "SECOND@EXAMPLE.INVALID",
};

function transaction(): InviteChurchUserTransaction {
  return {
    createChurchMembership: vi.fn(),
    createCredential: vi.fn().mockResolvedValue({ userId }),
    findActiveChurch: vi
      .fn()
      .mockResolvedValue({ id: churchId, name: "テスト教会" }),
    findActiveOperator: vi.fn().mockResolvedValue(true),
    isPendingUser: vi.fn().mockResolvedValue(true),
  };
}

function dependencies(tx = transaction()) {
  return {
    generatePassword: vi.fn(() => "t".repeat(24)),
    removeUnsentInvitation: vi.fn(),
    runTransaction: vi.fn(async (operation) => operation(tx)),
    sendInvitation: vi.fn(),
    tx,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("createChurchUserInviter", () => {
  it("adds a pending credential to the selected church and emails it", async () => {
    const deps = dependencies();

    await expect(
      createChurchUserInviter(deps)(operatorId, input),
    ).resolves.toEqual({
      churchId,
      churchName: "テスト教会",
      email: "second@example.invalid",
      userId,
    });
    expect(deps.tx.createCredential).toHaveBeenCalledWith({
      email: "second@example.invalid",
      name: input.accountName,
      password: "t".repeat(24),
    });
    expect(deps.tx.createChurchMembership).toHaveBeenCalledWith(
      churchId,
      userId,
    );
    expect(deps.sendInvitation).toHaveBeenCalledWith("second@example.invalid");
  });

  it("rejects invalid input and inactive operators or churches", async () => {
    const invalid = dependencies();
    await expect(
      createChurchUserInviter(invalid)(operatorId, {
        ...input,
        email: "invalid",
      }),
    ).rejects.toBeInstanceOf(ChurchUserInvitationInputError);
    expect(invalid.runTransaction).not.toHaveBeenCalled();

    const denied = dependencies();
    vi.mocked(denied.tx.findActiveOperator).mockResolvedValue(false);
    await expect(
      createChurchUserInviter(denied)(operatorId, input),
    ).rejects.toBeInstanceOf(ChurchUserInvitationAuthorizationError);

    const suspended = dependencies();
    vi.mocked(suspended.tx.findActiveChurch).mockResolvedValue(null);
    await expect(
      createChurchUserInviter(suspended)(operatorId, input),
    ).rejects.toBeInstanceOf(ChurchUserInvitationFailedError);
    expect(suspended.tx.createCredential).not.toHaveBeenCalled();
  });

  it("removes only the new pending user when delivery fails", async () => {
    const deps = dependencies();
    deps.sendInvitation.mockRejectedValue(new Error("smtp"));

    await expect(
      createChurchUserInviter(deps)(operatorId, input),
    ).rejects.toBeInstanceOf(ChurchUserInvitationFailedError);
    expect(deps.removeUnsentInvitation).toHaveBeenCalledWith(userId);
  });
});
