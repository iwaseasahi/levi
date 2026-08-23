import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateTemporaryPassword: vi.fn(() => "t".repeat(24)),
  hashPassword: vi.fn(async (value: string) => `hashed:${value}`),
  prisma: {
    $transaction: vi.fn(),
    platformOperator: { findUnique: vi.fn() },
  },
}));

vi.mock("better-auth/crypto", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/infrastructure/database/client", () => ({ prisma: mocks.prisma }));
vi.mock("@/application/admin/temporary-password", () => ({
  generateTemporaryPassword: mocks.generateTemporaryPassword,
}));

import {
  completeForcedPasswordChange,
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleFailedError,
  PasswordLifecycleInputError,
  resetChurchPassword,
} from "./password-lifecycle";

const operatorId = "00000000-0000-4000-8000-000000000001";
const churchId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const sessionId = "00000000-0000-4000-8000-000000000004";

function resetTransaction() {
  return {
    account: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    church: {
      findFirst: vi.fn().mockResolvedValue({
        id: churchId,
        membership: {
          user: {
            actorState: "ACTIVE",
            email: "church@example.invalid",
            id: userId,
          },
        },
        name: "テスト教会",
      }),
    },
    platformOperator: {
      findUnique: vi.fn().mockResolvedValue({ user: { actorState: "ACTIVE" } }),
    },
    session: { deleteMany: vi.fn() },
    user: { update: vi.fn() },
  };
}

function changeTransaction() {
  return {
    account: { update: vi.fn() },
    session: {
      deleteMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ id: sessionId }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({
        accounts: [{ id: "account-id", password: "old-hash" }],
      }),
      update: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.platformOperator.findUnique.mockResolvedValue({
    user: { actorState: "ACTIVE" },
  });
});

describe("resetChurchPassword", () => {
  it("rejects malformed identifiers before database access", async () => {
    await expect(
      resetChurchPassword(operatorId, "invalid"),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
    await expect(
      resetChurchPassword("invalid", churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);
    expect(mocks.prisma.platformOperator.findUnique).not.toHaveBeenCalled();
  });

  it("replaces the credential and revokes sessions for an active church", async () => {
    const tx = resetTransaction();
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    await expect(resetChurchPassword(operatorId, churchId)).resolves.toEqual({
      churchId,
      churchName: "テスト教会",
      email: "church@example.invalid",
      temporaryPassword: "t".repeat(24),
      userId,
    });
    expect(tx.account.updateMany).toHaveBeenCalledWith({
      data: { password: `hashed:${"t".repeat(24)}` },
      where: { providerId: "credential", userId },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      data: { mustChangePassword: true },
      where: { id: userId },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId } });
  });

  it("fails closed when authorization lookup or transactional state is invalid", async () => {
    mocks.prisma.platformOperator.findUnique.mockRejectedValueOnce(
      new Error("db"),
    );
    await expect(
      resetChurchPassword(operatorId, churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);

    mocks.prisma.platformOperator.findUnique.mockResolvedValueOnce({
      user: { actorState: "SUSPENDED" },
    });
    await expect(
      resetChurchPassword(operatorId, churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    const tx = resetTransaction();
    tx.platformOperator.findUnique.mockResolvedValueOnce({
      user: { actorState: "SUSPENDED" },
    });
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(tx),
    );
    await expect(
      resetChurchPassword(operatorId, churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    const missingAccount = resetTransaction();
    missingAccount.account.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(missingAccount),
    );
    await expect(
      resetChurchPassword(operatorId, churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);
  });
});

describe("completeForcedPasswordChange", () => {
  it("validates length and confirmation before database access", async () => {
    await expect(
      completeForcedPasswordChange({
        confirmation: "short",
        newPassword: "short",
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
    await expect(
      completeForcedPasswordChange({
        confirmation: "y".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
  });

  it("updates the credential, clears the forced state, and keeps this session", async () => {
    const tx = changeTransaction();
    mocks.prisma.$transaction.mockImplementation(async (callback) =>
      callback(tx),
    );
    const password = "new-password-value";

    await expect(
      completeForcedPasswordChange({
        confirmation: password,
        newPassword: password,
        sessionId,
        userId,
      }),
    ).resolves.toBeUndefined();
    expect(tx.account.update).toHaveBeenCalledWith({
      data: { password: `hashed:${password}` },
      where: { id: "account-id" },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      data: { mustChangePassword: false },
      where: { id: userId },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { id: { not: sessionId }, userId },
    });
  });

  it("distinguishes ineligible sessions from persistence failures", async () => {
    const unauthorized = changeTransaction();
    unauthorized.session.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(unauthorized),
    );
    await expect(
      completeForcedPasswordChange({
        confirmation: "x".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    mocks.prisma.$transaction.mockRejectedValueOnce(new Error("db"));
    await expect(
      completeForcedPasswordChange({
        confirmation: "x".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);
  });
});
