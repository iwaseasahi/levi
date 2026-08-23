import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeContent } from "./home-content";

describe("Home", () => {
  it("renders only the title and login action", () => {
    const { container } = render(<HomeContent isLoggedIn={false} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Leviシステム",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(container.querySelector(".card")?.children).toHaveLength(2);
    expect(container.querySelector(".eyebrow")).not.toBeInTheDocument();
    expect(container.querySelector("p")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /health/i }),
    ).not.toBeInTheDocument();
  });

  it("links an authenticated church user directly to scripture search", () => {
    render(<HomeContent isLoggedIn />);

    expect(screen.getByRole("link", { name: "聖書検索" })).toHaveAttribute(
      "href",
      "/scripture",
    );
    expect(
      screen.queryByRole("link", { name: "ログイン" }),
    ).not.toBeInTheDocument();
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<HomeContent isLoggedIn />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
