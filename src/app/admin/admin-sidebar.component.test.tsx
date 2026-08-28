import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminSidebar } from "./admin-sidebar";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/admin"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));
vi.mock("./auth-actions", () => ({
  adminLogoutAction: vi.fn(),
}));

describe("AdminSidebar", () => {
  it("exposes each administration destination and the current page", () => {
    render(<AdminSidebar />);

    expect(
      screen.getByRole("link", { name: "トップ" }).getAttribute("aria-current"),
    ).toBe("page");

    expect(
      screen.getByRole("link", { name: "教会一覧" }).getAttribute("href"),
    ).toBe("/admin/churches");
    expect(screen.queryByRole("link", { name: "教会を作成" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "パスワードを再設定" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "管理者一覧" }).getAttribute("href"),
    ).toBe("/admin/admin-users");
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
  });

  it("keeps the church directory current for nested church routes", () => {
    mockUsePathname.mockReturnValue("/admin/churches/new");
    render(<AdminSidebar />);

    expect(
      screen
        .getByRole("link", { name: "教会一覧" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("link", { name: "教会を作成" })).toBeNull();
  });
});
