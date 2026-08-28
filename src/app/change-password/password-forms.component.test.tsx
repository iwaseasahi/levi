import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";
import { ResetPasswordForm } from "@/app/admin/churches/reset-password-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe("password lifecycle forms", () => {
  it("confirms reset and reveals then dismisses the one-time value", async () => {
    const user = userEvent.setup();
    render(
      <ResetPasswordForm
        users={[
          {
            churchName: "対象教会",
            email: "member@example.invalid",
            id: "user-id",
            name: "対象利用者",
          },
        ]}
        action={vi.fn().mockResolvedValue({
          status: "success",
          churchName: "対象教会",
          email: "member@example.invalid",
          temporaryPassword: "t".repeat(24),
          message: "再設定しました",
        })}
      />,
    );
    await user.selectOptions(screen.getByLabelText("対象利用者"), "user-id");
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "パスワードを再設定" }),
    );
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveFocus());
    expect(screen.queryByText("t".repeat(24))).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "一時パスワードを表示" }),
    );
    expect(screen.getByText("t".repeat(24))).toBeVisible();
    await user.click(screen.getByRole("button", { name: "表示を閉じる" }));
    expect(screen.queryByText("t".repeat(24))).not.toBeInTheDocument();
  });

  it("submits the new password fields and focuses a safe error", async () => {
    const user = userEvent.setup();
    render(
      <ChangePasswordForm
        action={vi.fn().mockResolvedValue({
          status: "error",
          message: "パスワードを変更できませんでした。もう一度お試しください。",
        })}
      />,
    );
    expect(
      screen.queryByLabelText("現在の一時パスワード"),
    ).not.toBeInTheDocument();
    const password = screen.getByLabelText("新しいパスワード", {
      exact: true,
    });
    const confirmation = screen.getByLabelText("新しいパスワード（確認）");
    await user.type(password, "n".repeat(16));
    await user.type(confirmation, "n".repeat(16));
    await user.click(
      screen.getByRole("button", { name: "新しいパスワードを表示" }),
    );
    expect(password).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");
    expect(password).toHaveValue("n".repeat(16));
    await user.click(
      screen.getByRole("button", {
        name: "新しいパスワード（確認）を表示",
      }),
    );
    expect(confirmation).toHaveAttribute("type", "text");
    expect(confirmation).toHaveValue("n".repeat(16));
    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent(
      "パスワードを変更できませんでした。もう一度お試しください。",
    );
  });
});
