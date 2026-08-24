import { describe, expect, it } from "vitest";
import { parseAdminUserInvitationInput } from "./admin-user-invitation-input";

describe("parseAdminUserInvitationInput", () => {
  it("normalizes the login ID", () => {
    expect(
      parseAdminUserInvitationInput({
        loginId: " Admin.USER ",
        name: " 管理者 ",
      }),
    ).toEqual({
      data: { loginId: "admin.user", name: "管理者" },
      success: true,
    });
  });

  it("rejects invalid identifiers", () => {
    expect(
      parseAdminUserInvitationInput({ loginId: "管理者", name: " " }),
    ).toMatchObject({
      errors: {
        loginId: ["ログインIDは半角英数字と . _ @ - で入力してください。"],
        name: ["管理者名を入力してください。"],
      },
      success: false,
    });
  });
});
