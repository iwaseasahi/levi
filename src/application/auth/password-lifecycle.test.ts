import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPasswordLifecycle,
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleFailedError,
  PasswordLifecycleInputError,
  type PasswordLifecycleTransaction,
} from "./password-lifecycle";

const userId = "00000000-0000-4000-8000-000000000003";
const sessionId = "00000000-0000-4000-8000-000000000004";

function transaction(): PasswordLifecycleTransaction {
  return {
    clearForcedPasswordChange: vi.fn(),
    findForcedChangeAccount: vi
      .fn()
      .mockResolvedValue({ accountId: "account-id" }),
    revokeOtherSessions: vi.fn(),
    updateCredentialPassword: vi.fn(),
  };
}

function dependencies(tx = transaction()) {
  return {
    hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
    runTransaction: vi.fn(async (operation) => operation(tx)),
    tx,
  };
}

beforeEach(() => vi.clearAllMocks());

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
