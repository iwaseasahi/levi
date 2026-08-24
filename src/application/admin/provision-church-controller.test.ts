import { describe, expect, it, vi } from "vitest";

import { ProvisioningFailedError } from "./provision-church";
import { createProvisionChurchController } from "./provision-church-controller";

const validInput = {
  accountName: "教会利用者",
  churchName: "テスト教会",
  email: "church@example.invalid",
};

describe("createProvisionChurchController", () => {
  it("denies unauthenticated access before validation or mutation", async () => {
    const provisionChurch = vi.fn();
    const recordEvent = vi.fn();
    const controller = createProvisionChurchController({
      getOperatorAccess: vi
        .fn()
        .mockResolvedValue({ status: "unauthenticated" }),
      provisionChurch,
      recordEvent,
    });

    await expect(
      controller(new Headers(), { ...validInput, email: "invalid" }, "req-1"),
    ).resolves.toMatchObject({ status: "not-authorized" });
    expect(provisionChurch).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith({
      outcome: "denied",
      requestId: "req-1",
    });
  });

  it("returns field errors without passing invalid values to the use case", async () => {
    const provisionChurch = vi.fn();
    const controller = createProvisionChurchController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      provisionChurch,
      recordEvent: vi.fn(),
    });

    await expect(
      controller(new Headers(), { ...validInput, churchName: " " }),
    ).resolves.toMatchObject({
      status: "validation-error",
      fieldErrors: { churchName: ["教会名を入力してください。"] },
    });
    expect(provisionChurch).not.toHaveBeenCalled();
  });

  it("returns only the successful operator DTO", async () => {
    const recordEvent = vi.fn();
    const controller = createProvisionChurchController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      provisionChurch: vi.fn().mockResolvedValue({
        churchId: "church-id",
        churchName: "テスト教会",
        email: "church@example.invalid",
        temporaryPassword: "t".repeat(24),
        userId: "church-user-id",
      }),
      recordEvent,
    });

    await expect(
      controller(new Headers(), validInput, "req-2"),
    ).resolves.toEqual({
      churchName: "テスト教会",
      email: "church@example.invalid",
      message: "教会と初期アカウントを作成しました。",
      status: "success",
      temporaryPassword: "t".repeat(24),
    });
    expect(recordEvent).toHaveBeenCalledWith({
      actorAdminUserId: "operator-id",
      outcome: "succeeded",
      requestId: "req-2",
      targetChurchId: "church-id",
    });
  });

  it("maps persistence errors to one existence-safe response", async () => {
    const controller = createProvisionChurchController({
      getOperatorAccess: vi.fn().mockResolvedValue({
        status: "authorized",
        adminUserId: "operator-id",
      }),
      provisionChurch: vi.fn().mockRejectedValue(new ProvisioningFailedError()),
      recordEvent: vi.fn(),
    });

    const result = await controller(new Headers(), validInput);

    expect(result).toEqual({
      message:
        "作成できませんでした。入力内容を確認して、もう一度お試しください。",
      status: "server-error",
    });
    expect(JSON.stringify(result)).not.toContain("church@example.invalid");
  });
});
