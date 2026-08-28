import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdministrationPage from "./page";

vi.mock("@/infrastructure/auth/admin-page-access", () => ({
  requireAdminPageAccess: vi.fn().mockResolvedValue({
    adminUserId: "admin-1",
    mustChangePassword: false,
    name: "管理者",
    sessionId: "session-1",
    status: "authorized",
  }),
}));

describe("AdministrationPage", () => {
  it("offers every primary administration workflow accessibly", async () => {
    const { container } = render(await AdministrationPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "管理画面" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /教会の一覧/ })).toHaveAttribute(
      "href",
      "/admin/churches",
    );
    expect(screen.getByRole("link", { name: /教会を作成/ })).toHaveAttribute(
      "href",
      "/admin/churches/new",
    );
    expect(
      screen.queryByRole("link", { name: /パスワードを再設定/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /管理者の一覧/ })).toHaveAttribute(
      "href",
      "/admin/admin-users",
    );
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
});
