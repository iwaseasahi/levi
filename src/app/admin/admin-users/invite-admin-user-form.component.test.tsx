import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteAdminUserForm } from "./invite-admin-user-form";

describe("InviteAdminUserForm", () => {
  it("is accessible and only reveals the password on request", async () => {
    const password = "t".repeat(24);
    const action = vi.fn().mockResolvedValue({
      loginId: "next.admin",
      message: "管理者を招待しました。",
      name: "次の管理者",
      status: "success",
      temporaryPassword: password,
    });
    const { container } = render(<InviteAdminUserForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("管理者名"), "次の管理者");
    await user.type(screen.getByLabelText("ログインID"), "next.admin");
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
    await user.click(screen.getByRole("button", { name: "管理者を招待" }));
    expect(screen.queryByText(password)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "一時パスワードを表示" }),
    );
    expect(await screen.findByText(password)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "表示を閉じる" }));
    expect(screen.queryByText(password)).not.toBeInTheDocument();
  });

  it("focuses and associates validation feedback", async () => {
    const action = vi.fn().mockResolvedValue({
      fieldErrors: { loginId: ["ログインIDを確認してください。"] },
      message: "入力内容を確認してください。",
      status: "validation-error",
    });
    render(<InviteAdminUserForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("管理者名"), "次の管理者");
    await user.type(screen.getByLabelText("ログインID"), "next.admin");
    await user.click(screen.getByRole("button", { name: "管理者を招待" }));
    expect(await screen.findByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("ログインID")).toHaveAttribute(
      "aria-describedby",
      "admin-login-id-errors admin-login-id-hint",
    );
  });
});
