import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteAdminUserForm } from "./invite-admin-user-form";

describe("InviteAdminUserForm", () => {
  it("is accessible and confirms email delivery without exposing a credential", async () => {
    const action = vi.fn().mockResolvedValue({
      email: "next.admin@example.com",
      message: "管理者へ招待メールを送信しました。",
      name: "次の管理者",
      status: "success",
    });
    const { container } = render(<InviteAdminUserForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("管理者名"), "次の管理者");
    await user.type(
      screen.getByLabelText("メールアドレス"),
      "next.admin@example.com",
    );
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
    await user.click(screen.getByRole("button", { name: "管理者を招待" }));
    expect(await screen.findByText("next.admin@example.com")).toBeVisible();
    expect(screen.getByText("メール内のリンクは1時間有効です。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "表示を閉じる" }));
    expect(
      screen.queryByText("メール内のリンクは1時間有効です。"),
    ).not.toBeInTheDocument();
  });

  it("focuses and associates validation feedback", async () => {
    const action = vi.fn().mockResolvedValue({
      fieldErrors: { email: ["メールアドレスを確認してください。"] },
      message: "入力内容を確認してください。",
      status: "validation-error",
    });
    render(<InviteAdminUserForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("管理者名"), "次の管理者");
    await user.type(
      screen.getByLabelText("メールアドレス"),
      "next.admin@example.com",
    );
    await user.click(screen.getByRole("button", { name: "管理者を招待" }));
    expect(await screen.findByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("メールアドレス")).toHaveAttribute(
      "aria-describedby",
      "admin-email-errors",
    );
  });
});
