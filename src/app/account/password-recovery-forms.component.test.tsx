import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountChangePasswordForm } from "./change-password/account-change-password-form";
import { ForgotPasswordForm } from "../forgot-password/forgot-password-form";
import { ResetPasswordForm } from "../reset-password/reset-password-form";

const { changePassword, replaceRoute, requestPasswordReset, resetPassword } =
  vi.hoisted(() => ({
    changePassword: vi.fn(),
    replaceRoute: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: replaceRoute }),
}));

vi.mock("@/infrastructure/auth/client", () => ({
  authClient: {
    changePassword,
    requestPasswordReset,
    resetPassword,
  },
}));

beforeEach(() => {
  changePassword.mockReset().mockResolvedValue({ data: {} });
  replaceRoute.mockReset();
  requestPasswordReset.mockReset().mockResolvedValue({ data: {} });
  resetPassword.mockReset().mockResolvedValue({ data: {} });
});

describe("church password recovery forms", () => {
  it("requests a reset without revealing whether the account exists", async () => {
    render(<ForgotPasswordForm />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("メールアドレス"),
      "USER@Example.com ",
    );
    await user.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "user@example.com",
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "登録済みのメールアドレスであれば、再設定メールを送信しました。",
    );
  });

  it("sets a password from a valid emailed token", async () => {
    render(<ResetPasswordForm token="reset-token" />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("新しいパスワード", { exact: true }),
      "new-password-123",
    );
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）", { exact: true }),
      "new-password-123",
    );
    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: "new-password-123",
        token: "reset-token",
      }),
    );
    expect(replaceRoute).toHaveBeenCalledWith("/login?passwordReset=completed");
  });

  it("changes the signed-in user's password and revokes other sessions", async () => {
    render(<AccountChangePasswordForm />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("現在のパスワード"),
      "current-password",
    );
    await user.type(
      screen.getByLabelText("新しいパスワード", { exact: true }),
      "replacement-password",
    );
    await user.type(
      screen.getByLabelText("新しいパスワード（確認）", { exact: true }),
      "replacement-password",
    );
    await user.click(screen.getByRole("button", { name: "パスワードを変更" }));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "current-password",
        newPassword: "replacement-password",
        revokeOtherSessions: true,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "パスワードを変更しました。",
    );
  });
});
