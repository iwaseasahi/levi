import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders only the title and login action", () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "礼拝投影システム Levi",
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

  it("has no automatically detectable accessibility violations", async () => {
    const { container } = render(<Home />);
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
