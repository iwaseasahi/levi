import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminSidebar } from "./admin-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

describe("AdminSidebar", () => {
  it("exposes each administration destination and the current page", () => {
    render(<AdminSidebar />);

    expect(
      screen.getByRole("link", { name: "トップ" }).getAttribute("aria-current"),
    ).toBe("page");

    expect(
      screen.getByRole("link", { name: "教会を作成" }).getAttribute("href"),
    ).toBe("/admin/churches/new");
    expect(
      screen
        .getByRole("link", { name: "パスワードを再設定" })
        .getAttribute("href"),
    ).toBe("/admin/churches/password-reset");
    expect(
      screen.getByRole("link", { name: "管理者一覧" }).getAttribute("href"),
    ).toBe("/admin/admin-users");
  });
});
