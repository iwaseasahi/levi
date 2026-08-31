import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChurchList } from "./church-list";

describe("ChurchList", () => {
  it("shows church and user states without exposing authentication data", async () => {
    const deleteAction = vi.fn();
    const { container } = render(
      <ChurchList
        churches={[
          {
            createdAt: new Date("2026-08-27T00:00:00Z"),
            id: "church-active",
            name: "第一教会",
            status: "ACTIVE",
            users: [
              {
                email: "member@example.com",
                id: "member-1",
                name: "教会利用者",
                status: "PENDING",
              },
              {
                email: "active@example.com",
                id: "member-2",
                name: "第二利用者",
                status: "ACTIVE",
              },
            ],
          },
          {
            createdAt: new Date("2026-08-28T00:00:00Z"),
            id: "church-suspended",
            name: "第二教会",
            status: "SUSPENDED",
            users: [],
          },
        ]}
        deleteAction={deleteAction}
        deleteUserAction={vi.fn()}
      />,
    );

    expect(screen.getByText("第一教会")).toBeVisible();
    expect(screen.getByText("教会利用者")).toBeVisible();
    expect(screen.getByText("第二利用者")).toBeVisible();
    expect(screen.getByText("member@example.com")).toBeVisible();
    expect(screen.getByText("招待中")).toBeVisible();
    expect(screen.getByText("停止中")).toBeVisible();
    expect(screen.getByText("利用者は未登録です。")).toBeVisible();
    const inviteLink = screen.getByRole("link", {
      name: "第一教会に利用者を招待",
    });
    expect(inviteLink).toHaveAttribute(
      "href",
      "/admin/churches/church-active/users/invite",
    );
    expect(inviteLink).toHaveClass("admin-church-action-control");
    expect(
      inviteLink.parentElement?.querySelector(".status-badge"),
    ).toHaveClass("admin-church-action-control");
    expect(
      screen.queryByRole("link", { name: "第二教会に利用者を招待" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "第一教会を削除" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "第二教会を削除" }),
    ).toBeVisible();
    expect(container.textContent).not.toContain("password");
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it("shows an empty state when no churches are registered", () => {
    render(
      <ChurchList
        churches={[]}
        deleteAction={vi.fn()}
        deleteUserAction={vi.fn()}
      />,
    );

    expect(screen.getByText("教会はまだ登録されていません。")).toBeVisible();
  });
});
