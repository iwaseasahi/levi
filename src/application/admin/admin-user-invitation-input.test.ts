import { describe, expect, it } from "vitest";
import { parseAdminUserInvitationInput } from "./admin-user-invitation-input";

describe("parseAdminUserInvitationInput", () => {
  it("normalizes the email address", () => {
    expect(
      parseAdminUserInvitationInput({
        email: " ADMIN@example.com ",
        name: " 管理者 ",
      }),
    ).toEqual({
      data: {
        email: "admin@example.com",
        name: "管理者",
      },
      success: true,
    });
  });

  it("rejects invalid identifiers", () => {
    expect(
      parseAdminUserInvitationInput({
        email: "not-an-email",
        name: " ",
      }),
    ).toMatchObject({
      errors: {
        email: ["有効なメールアドレスを入力してください。"],
        name: ["管理者名を入力してください。"],
      },
      success: false,
    });
  });
});
