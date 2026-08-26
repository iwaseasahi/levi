import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserList } from "./admin-user-list";

const deleteAction = async () => ({
  status: "success" as const,
  message: "deleted",
});

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
        currentAdminUserId="admin-2"
        deleteAction={deleteAction}
      />,
    );

    expect(screen.queryByText("basic-bootstrap")).not.toBeInTheDocument();
    expect(screen.queryByText("Basic認証")).not.toBeInTheDocument();
    expect(screen.getByText("invited.admin")).toBeVisible();
    expect(screen.getByText("初回パスワード変更待ち")).toBeVisible();
    expect(screen.getByText("現在の管理者")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "削除" }),
    ).not.toBeInTheDocument();
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
        currentAdminUserId="admin-1"
        deleteAction={deleteAction}
      />,
    );

    expect(screen.queryByText("basic-bootstrap")).not.toBeInTheDocument();
    expect(screen.getByText("管理者はまだ登録されていません。")).toBeVisible();
  });

  it("offers deletion for another administrator", () => {
    render(
      <AdminUserList
        adminUsers={[
          {
            createdAt: new Date("2026-08-24T01:00:00Z"),
            id: "admin-2",
            loginId: "other.admin",
            name: "別の管理者",
            status: "ACTIVE",
          },
        ]}
        currentAdminUserId="admin-1"
        deleteAction={deleteAction}
      />,
    );

    expect(screen.getByRole("button", { name: "削除" })).toBeVisible();
    expect(screen.queryByText("現在の管理者")).not.toBeInTheDocument();
  });
});
