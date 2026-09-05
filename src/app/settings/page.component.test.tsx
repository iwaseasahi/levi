import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DefaultSettingsPage from "./page";

const { requireChurchPageAccess } = vi.hoisted(() => ({
  requireChurchPageAccess: vi.fn().mockResolvedValue({
    churchId: "00000000-0000-4000-8000-000000000478",
  }),
}));

vi.mock("@/app/church/require-church-page-access", () => ({
  requireChurchPageAccess,
}));

describe("DefaultSettingsPage", () => {
  beforeEach(() => {
    requireChurchPageAccess.mockClear();
    window.localStorage.clear();
  });

  it("requires Church access and renders the dedicated settings screen", async () => {
    render(await DefaultSettingsPage());

    expect(requireChurchPageAccess).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "デフォルト設定" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", {
        name: "聖書投影のデフォルト文字サイズ",
      }),
    ).toBeVisible();
  });
});
