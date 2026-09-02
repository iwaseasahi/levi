import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmailChangeService,
  EmailChangeAuthorizationError,
  EmailChangeConflictError,
  EmailChangeFailedError,
  EmailChangeInputError,
  EmailChangeRateLimitError,
  type EmailChangeDependencies,
} from "./email-change";

const dependencies: EmailChangeDependencies = {
  consumeRequest: vi.fn(),
  createVerificationUrl: vi.fn(),
  findCredential: vi.fn(),
  isEmailInUse: vi.fn(),
  sendVerificationMail: vi.fn(),
  verifyPassword: vi.fn(),
};

describe("email change service", () => {
  beforeEach(() => {
    vi.mocked(dependencies.consumeRequest).mockReset().mockResolvedValue(true);
    vi.mocked(dependencies.createVerificationUrl)
      .mockReset()
      .mockResolvedValue("https://example.invalid/verify");
    vi.mocked(dependencies.findCredential).mockReset().mockResolvedValue({
      email: "current@example.invalid",
      name: "Synthetic User",
      passwordHash: "synthetic-hash",
    });
    vi.mocked(dependencies.isEmailInUse).mockReset().mockResolvedValue(false);
    vi.mocked(dependencies.sendVerificationMail)
      .mockReset()
      .mockResolvedValue(undefined);
    vi.mocked(dependencies.verifyPassword).mockReset().mockResolvedValue(true);
  });

  it("normalizes matching addresses and sends one verification link", async () => {
    const service = createEmailChangeService(dependencies);

    await service.requestChange({
      confirmation: "new@example.invalid",
      currentPassword: "current-password",
      newEmail: " NEW@Example.Invalid ",
      userId: "user-id",
    });

    expect(dependencies.verifyPassword).toHaveBeenCalledWith({
      hash: "synthetic-hash",
      password: "current-password",
    });
    expect(dependencies.createVerificationUrl).toHaveBeenCalledWith({
      currentEmail: "current@example.invalid",
      newEmail: "new@example.invalid",
    });
    expect(dependencies.sendVerificationMail).toHaveBeenCalledExactlyOnceWith({
      name: "Synthetic User",
      to: "new@example.invalid",
      verificationUrl: "https://example.invalid/verify",
    });
  });

  it.each([
    { confirmation: "other@example.invalid", newEmail: "new@example.invalid" },
    { confirmation: "invalid", newEmail: "invalid" },
  ])("rejects invalid input before consuming a request", async (input) => {
    const service = createEmailChangeService(dependencies);
    await expect(
      service.requestChange({
        ...input,
        currentPassword: "current-password",
        userId: "user-id",
      }),
    ).rejects.toBeInstanceOf(EmailChangeInputError);
    expect(dependencies.consumeRequest).not.toHaveBeenCalled();
  });

  it("rejects a wrong password without creating a link", async () => {
    vi.mocked(dependencies.verifyPassword).mockResolvedValue(false);
    await expect(
      createEmailChangeService(dependencies).requestChange({
        confirmation: "new@example.invalid",
        currentPassword: "wrong-password",
        newEmail: "new@example.invalid",
        userId: "user-id",
      }),
    ).rejects.toBeInstanceOf(EmailChangeAuthorizationError);
    expect(dependencies.createVerificationUrl).not.toHaveBeenCalled();
  });

  it.each(["current@example.invalid", "used@example.invalid"])(
    "rejects a current or used address without sending mail",
    async (newEmail) => {
      vi.mocked(dependencies.isEmailInUse).mockResolvedValue(
        newEmail === "used@example.invalid",
      );
      await expect(
        createEmailChangeService(dependencies).requestChange({
          confirmation: newEmail,
          currentPassword: "current-password",
          newEmail,
          userId: "user-id",
        }),
      ).rejects.toBeInstanceOf(EmailChangeConflictError);
      expect(dependencies.sendVerificationMail).not.toHaveBeenCalled();
    },
  );

  it("stops before credential access when rate limited", async () => {
    vi.mocked(dependencies.consumeRequest).mockResolvedValue(false);
    await expect(
      createEmailChangeService(dependencies).requestChange({
        confirmation: "new@example.invalid",
        currentPassword: "current-password",
        newEmail: "new@example.invalid",
        userId: "user-id",
      }),
    ).rejects.toBeInstanceOf(EmailChangeRateLimitError);
    expect(dependencies.findCredential).not.toHaveBeenCalled();
  });

  it("maps mail delivery failures without exposing their details", async () => {
    vi.mocked(dependencies.sendVerificationMail).mockRejectedValue(
      new Error("synthetic SMTP detail"),
    );
    await expect(
      createEmailChangeService(dependencies).requestChange({
        confirmation: "new@example.invalid",
        currentPassword: "current-password",
        newEmail: "new@example.invalid",
        userId: "user-id",
      }),
    ).rejects.toBeInstanceOf(EmailChangeFailedError);
  });
});
