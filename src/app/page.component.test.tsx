import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders the walking-skeleton navigation", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "礼拝投影システム Levi",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("教会用画面を利用するには、ログインしてください。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ログイン画面へ" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.queryByRole("link", { name: /health/i }),
    ).not.toBeInTheDocument();
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<Home />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
