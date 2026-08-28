import { describe, expect, it, vi } from "vitest";

import {
  PasswordLifecycleAuthorizationError,
  PasswordLifecycleFailedError,
  PasswordLifecycleInputError,
} from "./password-lifecycle";
import { createChangePasswordController } from "./password-lifecycle-controller";

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
