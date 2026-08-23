import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPasswordLifecycle,
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleFailedError,
  PasswordLifecycleInputError,
  type PasswordLifecycleTransaction,
} from "./password-lifecycle";

const operatorId = "00000000-0000-4000-8000-000000000001";
const churchId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const sessionId = "00000000-0000-4000-8000-000000000004";

function transaction(): PasswordLifecycleTransaction {
  return {
    clearForcedPasswordChange: vi.fn(),
    findActiveOperator: vi.fn().mockResolvedValue(true),
    findForcedChangeAccount: vi
      .fn()
      .mockResolvedValue({ accountId: "account-id" }),
    findResetTarget: vi.fn().mockResolvedValue({
      churchId,
      churchName: "テスト教会",
      email: "church@example.invalid",
      userId,
    }),
    markForcedPasswordChange: vi.fn(),
    replaceCredentialPassword: vi.fn().mockResolvedValue(true),
    revokeAllSessions: vi.fn(),
    revokeOtherSessions: vi.fn(),
    updateCredentialPassword: vi.fn(),
  };
}

function dependencies(tx = transaction()) {
  return {
    findActiveOperator: vi.fn().mockResolvedValue(true),
    generateTemporaryPassword: vi.fn(() => "t".repeat(24)),
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
    runTransaction: vi.fn(async (operation) => operation(tx)),
    tx,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("resetChurchPassword", () => {
  it("rejects invalid identifiers before opening a transaction", async () => {
    const deps = dependencies();
    const lifecycle = createPasswordLifecycle(deps);
    await expect(
      lifecycle.resetChurchPassword(operatorId, "invalid"),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
    await expect(
      lifecycle.resetChurchPassword("invalid", churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("replaces the credential and revokes all sessions", async () => {
    const deps = dependencies();
    const lifecycle = createPasswordLifecycle(deps);
    await expect(
      lifecycle.resetChurchPassword(operatorId, churchId),
    ).resolves.toEqual({
      churchId,
      churchName: "テスト教会",
      email: "church@example.invalid",
      temporaryPassword: "t".repeat(24),
      userId,
    });
    expect(deps.tx.replaceCredentialPassword).toHaveBeenCalledWith(
      userId,
      `hashed:${"t".repeat(24)}`,
    );
    expect(deps.tx.markForcedPasswordChange).toHaveBeenCalledWith(userId);
    expect(deps.tx.revokeAllSessions).toHaveBeenCalledWith(userId);
  });

  it("fails closed before and during the transaction", async () => {
    const lookupFailed = dependencies();
    lookupFailed.findActiveOperator.mockRejectedValue(new Error("db"));
    await expect(
      createPasswordLifecycle(lookupFailed).resetChurchPassword(
        operatorId,
        churchId,
      ),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);

    const denied = dependencies();
    denied.findActiveOperator.mockResolvedValue(false);
    await expect(
      createPasswordLifecycle(denied).resetChurchPassword(operatorId, churchId),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    const recheckDenied = dependencies();
    vi.mocked(recheckDenied.tx.findActiveOperator).mockResolvedValue(false);
    await expect(
      createPasswordLifecycle(recheckDenied).resetChurchPassword(
        operatorId,
        churchId,
      ),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    const missing = dependencies();
    vi.mocked(missing.tx.findResetTarget).mockResolvedValue(null);
    await expect(
      createPasswordLifecycle(missing).resetChurchPassword(
        operatorId,
        churchId,
      ),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);
  });
});

describe("completeForcedPasswordChange", () => {
  it("validates password length and confirmation before persistence", async () => {
    const deps = dependencies();
    const lifecycle = createPasswordLifecycle(deps);
    await expect(
      lifecycle.completeForcedPasswordChange({
        confirmation: "short",
        newPassword: "short",
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
    await expect(
      lifecycle.completeForcedPasswordChange({
        confirmation: "y".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleInputError);
    expect(deps.runTransaction).not.toHaveBeenCalled();
  });

  it("updates the credential and revokes only other sessions", async () => {
    const deps = dependencies();
    const lifecycle = createPasswordLifecycle(deps);
    const password = "new-password-value";
    await expect(
      lifecycle.completeForcedPasswordChange({
        confirmation: password,
        newPassword: password,
        sessionId,
        userId,
      }),
    ).resolves.toBeUndefined();
    expect(deps.tx.updateCredentialPassword).toHaveBeenCalledWith(
      "account-id",
      `hashed:${password}`,
    );
    expect(deps.tx.clearForcedPasswordChange).toHaveBeenCalledWith(userId);
    expect(deps.tx.revokeOtherSessions).toHaveBeenCalledWith(userId, sessionId);
  });

  it("distinguishes an ineligible session from an adapter failure", async () => {
    const unauthorized = dependencies();
    vi.mocked(unauthorized.tx.findForcedChangeAccount).mockResolvedValue(null);
    await expect(
      createPasswordLifecycle(unauthorized).completeForcedPasswordChange({
        confirmation: "x".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleAuthorizationError);

    const failed = dependencies();
    failed.runTransaction.mockRejectedValue(new Error("db"));
    await expect(
      createPasswordLifecycle(failed).completeForcedPasswordChange({
        confirmation: "x".repeat(12),
        newPassword: "x".repeat(12),
        sessionId,
        userId,
      }),
    ).rejects.toBeInstanceOf(PasswordLifecycleFailedError);
  });
});
