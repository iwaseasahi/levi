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

  it("opens from the settings icon and closes outside or with Escape", async () => {
    render(<ScriptureSettingsMenu />);
    const user = userEvent.setup();
    const settings = screen.getByRole("button", { name: "設定" });

    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("menuitem", { name: "ログアウト" }),
    ).not.toBeInTheDocument();

    await user.click(settings);
    expect(settings).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "ログアウト" })).toBeVisible();

    await user.click(document.body);
    expect(settings).toHaveAttribute("aria-expanded", "false");

    await user.click(settings);
    await user.keyboard("{Escape}");
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(settings).toHaveFocus();
  });

  it("signs out once and replaces the current route with login", async () => {
    let completeSignOut!: () => void;
    signOut.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeSignOut = resolve;
        }),
    );
    render(<ScriptureSettingsMenu />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.click(screen.getByRole("menuitem", { name: "ログアウト" }));
    const pending = screen.getByRole("menuitem", { name: "ログアウト中…" });
    expect(pending).toBeDisabled();
    expect(signOut).toHaveBeenCalledTimes(1);

    completeSignOut();
    await waitFor(() => expect(replaceRoute).toHaveBeenCalledWith("/login"));
  });
});
