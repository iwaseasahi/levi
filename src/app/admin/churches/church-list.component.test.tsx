import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChurchList } from "./church-list";

describe("ChurchList", () => {
  it("shows church and user states without exposing authentication data", async () => {
    const { container } = render(
      <ChurchList
        churches={[
          {
            createdAt: new Date("2026-08-27T00:00:00Z"),
            id: "church-active",
            name: "第一教会",
            status: "ACTIVE",
            user: {
              email: "member@example.com",
              name: "教会利用者",
              status: "PENDING",
            },
          },
          {
            createdAt: new Date("2026-08-28T00:00:00Z"),
            id: "church-suspended",
            name: "第二教会",
            status: "SUSPENDED",
            user: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("第一教会")).toBeVisible();
    expect(screen.getByText("教会利用者")).toBeVisible();
    expect(screen.getByText("member@example.com")).toBeVisible();
    expect(screen.getByText("招待中")).toBeVisible();
    expect(screen.getByText("停止中")).toBeVisible();
    expect(screen.getByText("利用者は未登録です。")).toBeVisible();
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
    render(<ChurchList churches={[]} />);

    expect(screen.getByText("教会はまだ登録されていません。")).toBeVisible();
  });
});
