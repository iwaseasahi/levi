import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, replace, signIn } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("@/infrastructure/auth/client", () => ({
  authClient: { signIn: { email: signIn } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    signIn.mockReset();
    refresh.mockReset();
    replace.mockReset();
  });

  it("is keyboard accessible and submits normalized credentials", async () => {
    signIn.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);
    await user.type(
      screen.getByLabelText("メールアドレス"),
      " MEMBER@EXAMPLE.INVALID ",
    );
    await user.type(screen.getByLabelText("パスワード"), "p".repeat(16));
    await user.click(screen.getByRole("button", { name: "ログイン" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/church"));
    expect(refresh).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({ email: "member@example.invalid" }),
    );
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it("shows the same focused generic error for every rejection", async () => {
    signIn.mockResolvedValue({ data: null, error: { message: "specific" } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("メールアドレス"),
      "missing@example.invalid",
    );
    await user.type(screen.getByLabelText("パスワード"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "ログインできませんでした。メールアドレスとパスワードを確認してください。",
    );
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
