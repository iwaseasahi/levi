import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScriptureSettingsMenu } from "./scripture-settings-menu";

const { replaceRoute, signOut } = vi.hoisted(() => ({
  replaceRoute: vi.fn(),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceRoute }),
}));

vi.mock("@/infrastructure/auth/client", () => ({
  authClient: { signOut },
}));

describe("ScriptureSettingsMenu", () => {
  beforeEach(() => {
    replaceRoute.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
  });

  function renderSettings() {
    render(<ScriptureSettingsMenu />);
  }

  it("opens from the settings icon and closes outside or with Escape", async () => {
    renderSettings();
    const user = userEvent.setup();
    const settings = screen.getByRole("button", { name: "設定" });

    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "ログアウト" }),
    ).not.toBeInTheDocument();

    await user.click(settings);
    expect(settings).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.queryByRole("link", { name: "スライド" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "デフォルト設定" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      screen.getByRole("link", { name: "メールアドレスを変更" }),
    ).toHaveAttribute("href", "/account/change-email");
    expect(
      screen.getByRole("link", { name: "パスワードを変更" }),
    ).toHaveAttribute("href", "/account/change-password");
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeVisible();

    await user.click(document.body);
    expect(settings).toHaveAttribute("aria-expanded", "false");

    await user.click(settings);
    await user.keyboard("{Escape}");
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(settings).toHaveFocus();
  });

  it("links to the dedicated default settings screen without an inline input", async () => {
    renderSettings();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "設定" }));
    expect(
      screen.getByRole("link", { name: "デフォルト設定" }),
    ).toHaveAttribute("href", "/settings");
    expect(
      screen.queryByRole("combobox", { name: "デフォルト文字サイズ" }),
    ).not.toBeInTheDocument();
  });

  it("signs out once and replaces the current route with login", async () => {
    let completeSignOut!: () => void;
    signOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSignOut = resolve;
        }),
    );
    renderSettings();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.click(screen.getByRole("button", { name: "ログアウト" }));
    const pending = screen.getByRole("button", { name: "ログアウト中…" });
    expect(pending).toBeDisabled();
    expect(signOut).toHaveBeenCalledTimes(1);

    completeSignOut();
    await waitFor(() => expect(replaceRoute).toHaveBeenCalledWith("/login"));
  });
});
