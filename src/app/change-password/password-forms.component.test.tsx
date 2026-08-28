import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "./change-password-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

describe("password lifecycle forms", () => {
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
