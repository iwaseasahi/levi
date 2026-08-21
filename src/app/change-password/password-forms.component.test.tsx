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
        churches={[{ id: "church-id", name: "対象教会" }]}
        action={vi.fn().mockResolvedValue({
          status: "success",
          churchName: "対象教会",
          email: "member@example.invalid",
          temporaryPassword: "t".repeat(24),
          message: "再設定しました",
        })}
      />,
    );
    await user.selectOptions(screen.getByLabelText("対象教会"), "church-id");
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

  it("submits all password fields and focuses a safe error", async () => {
    const user = userEvent.setup();
    render(
      <ChangePasswordForm
        action={vi.fn().mockResolvedValue({
          status: "error",
          message: "変更できませんでした。現在のパスワードを確認してください。",
        })}
      />,
    );
    await user.type(
      screen.getByLabelText("現在の一時パスワード"),
      "c".repeat(16),
    );
    await user.type(
      screen.getByLabelText("新しいパスワード", { exact: true }),
      "n".repeat(16),
    );
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）"),
      "n".repeat(16),
    );
    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).not.toHaveTextContent("c".repeat(16));
  });
});
