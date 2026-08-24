import { describe, expect, it, vi } from "vitest";

import {
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleFailedError,
  PasswordLifecycleInputError,
} from "./password-lifecycle";
import {
  createChangePasswordController,
  createResetPasswordController,
} from "./password-lifecycle-controller";

describe("reset password controller", () => {
  it("denies before validation or mutation and records the request ID", async () => {
    const resetChurchPassword = vi.fn();
    const recordEvent = vi.fn();
    const controller = createResetPasswordController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "forbidden",
        adminUserId: "operator-id",
      }),
      recordEvent,
      resetChurchPassword,
    });
    await expect(
      controller(
        new Headers(),
        { churchId: "invalid", confirmed: "yes" },
        "req-1",
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(resetChurchPassword).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "operator-id",
      operation: "reset",
      outcome: "denied",
      requestId: "req-1",
    });
  });

  it("validates confirmation before mutation", async () => {
    const resetChurchPassword = vi.fn();
    const recordEvent = vi.fn();
    const controller = createResetPasswordController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      recordEvent,
      resetChurchPassword,
    });
    await expect(
      controller(new Headers(), { churchId: "church-id", confirmed: null }),
    ).resolves.toEqual({
      status: "error",
      message: "確認欄を選択してください。",
    });
    expect(resetChurchPassword).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "validation_failed" }),
    );
  });

  it("returns only the temporary credential DTO and audits success", async () => {
    const recordEvent = vi.fn();
    const controller = createResetPasswordController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      recordEvent,
      resetChurchPassword: vi.fn().mockResolvedValue({
        churchId: "church-id",
        churchName: "テスト教会",
        email: "church@example.invalid",
        temporaryPassword: "t".repeat(24),
        userId: "user-id",
      }),
    });
    await expect(
      controller(
        new Headers(),
        { churchId: "church-id", confirmed: "yes" },
        "req-2",
      ),
    ).resolves.toMatchObject({
      status: "success",
      churchName: "テスト教会",
      temporaryPassword: "t".repeat(24),
    });
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "operator-id",
      operation: "reset",
      outcome: "succeeded",
      requestId: "req-2",
      targetChurchId: "church-id",
      targetUserId: "user-id",
    });
  });

  it("maps use-case failures to an existence-safe response", async () => {
    const recordEvent = vi.fn();
    const controller = createResetPasswordController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      recordEvent,
      resetChurchPassword: vi
        .fn()
        .mockRejectedValue(new PasswordLifecycleFailedError()),
    });
    await expect(
      controller(new Headers(), { churchId: "church-id", confirmed: "yes" }),
    ).resolves.toMatchObject({ status: "error" });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed" }),
    );
  });
});

describe("forced password change controller", () => {
  it("denies a missing forced-change session before mutation", async () => {
    const completeForcedPasswordChange = vi.fn();
    const recordEvent = vi.fn();
    const controller = createChangePasswordController({
      completeForcedPasswordChange,
      getForcedPasswordChangeSession: vi.fn().mockResolvedValue(null),
      recordEvent,
    });
    await expect(
      controller(
        new Headers(),
        { newPassword: "x", confirmation: "x" },
        "req-3",
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(completeForcedPasswordChange).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      operation: "change",
      outcome: "denied",
      requestId: "req-3",
    });
  });

  it.each([
    [new PasswordLifecycleInputError(), "validation_failed"],
    [new PasswordLifecycleAuthorizationError(), "denied"],
    [new PasswordLifecycleFailedError(), "failed"],
  ] as const)("maps %s and audits %s", async (error, outcome) => {
    const recordEvent = vi.fn();
    const controller = createChangePasswordController({
      completeForcedPasswordChange: vi.fn().mockRejectedValue(error),
      getForcedPasswordChangeSession: vi
        .fn()
        .mockResolvedValue({ sessionId: "session-id", userId: "user-id" }),
      recordEvent,
    });
    await expect(
      controller(new Headers(), {
        newPassword: "x".repeat(12),
        confirmation: "x".repeat(12),
      }),
    ).resolves.toMatchObject({ status: "error" });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "change", outcome }),
    );
  });

  it("audits a successful password change with the request ID", async () => {
    const recordEvent = vi.fn();
    const controller = createChangePasswordController({
      completeForcedPasswordChange: vi.fn(),
      getForcedPasswordChangeSession: vi
        .fn()
        .mockResolvedValue({ sessionId: "session-id", userId: "user-id" }),
      recordEvent,
    });
    await expect(
      controller(
        new Headers(),
        { newPassword: "x".repeat(12), confirmation: "x".repeat(12) },
        "req-4",
      ),
    ).resolves.toMatchObject({ status: "success" });
    expect(recordEvent).toHaveBeenCalledWith({
      actorUserId: "user-id",
      operation: "change",
      outcome: "succeeded",
      requestId: "req-4",
      targetUserId: "user-id",
    });
  });
});
