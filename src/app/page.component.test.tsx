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
        name: "Levi is ready for its first vertical slice.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View health status" }),
    ).toHaveAttribute("href", "/api/health");
  });

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<Home />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
