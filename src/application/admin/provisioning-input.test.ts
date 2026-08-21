import { describe, expect, it } from "vitest";

import { parseProvisioningInput } from "./provisioning-input";

describe("parseProvisioningInput", () => {
  it("normalizes the accepted operator input", () => {
    expect(
      parseProvisioningInput({
        churchName: "  テスト教会  ",
        accountName: "  教会利用者  ",
        email: "  CHURCH@EXAMPLE.INVALID  ",
      }),
    ).toEqual({
      success: true,
      data: {
        churchName: "テスト教会",
        accountName: "教会利用者",
        email: "church@example.invalid",
      },
    });
  });

  it("returns field-specific errors without accepting oversized or invalid data", () => {
    const result = parseProvisioningInput({
      churchName: " ",
      accountName: "x".repeat(201),
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toMatchObject({
        churchName: ["教会名を入力してください。"],
        accountName: ["利用者名は200文字以内で入力してください。"],
        email: ["有効なメールアドレスを入力してください。"],
      });
    }
  });
});
