import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserList } from "./admin-user-list";

describe("AdminUserList", () => {
  it("shows administrator identity and status accessibly", async () => {
    const { container } = render(
      <AdminUserList
        adminUsers={[
          {
            createdAt: new Date("2026-08-24T00:00:00Z"),
            id: "admin-1",
            loginId: "basic-bootstrap",
            name: "Levi Administrator",
            status: "BOOTSTRAP",
          },
          {
            createdAt: new Date("2026-08-24T01:00:00Z"),
            id: "admin-2",
            loginId: "invited.admin",
            name: "招待済み管理者",
            status: "INVITED",
          },
        ]}
      />,
    );

    expect(screen.queryByText("basic-bootstrap")).not.toBeInTheDocument();
    expect(screen.queryByText("Basic認証")).not.toBeInTheDocument();
    expect(screen.getByText("invited.admin")).toBeVisible();
    expect(screen.getByText("招待済み（ログイン未対応）")).toBeVisible();
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it("shows an empty state when only the Basic authentication identity exists", () => {
    render(
      <AdminUserList
        adminUsers={[
          {
            createdAt: new Date("2026-08-24T00:00:00Z"),
            id: "admin-1",
            loginId: "basic-bootstrap",
            name: "Levi Administrator",
            status: "BOOTSTRAP",
          },
        ]}
      />,
    );

    expect(screen.queryByText("basic-bootstrap")).not.toBeInTheDocument();
    expect(screen.getByText("管理者はまだ登録されていません。")).toBeVisible();
  });
});
