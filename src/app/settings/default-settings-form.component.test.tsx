import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { SCRIPTURE_FONT_SCALE_STORAGE_KEY } from "@/app/church/scripture-font-scale";
import { DefaultSettingsForm } from "./default-settings-form";

describe("DefaultSettingsForm", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the saved scripture default and persists changes", async () => {
    window.localStorage.setItem(SCRIPTURE_FONT_SCALE_STORAGE_KEY, "1.3");
    render(<DefaultSettingsForm />);
    const user = userEvent.setup();
    const select = screen.getByRole("combobox", {
      name: "聖書投影のデフォルト文字サイズ",
    });

    expect(select).toHaveValue("1.3");
    expect(screen.getByRole("option", { name: "60%" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "220%" })).toBeInTheDocument();

    await user.selectOptions(select, "1.6");

    expect(window.localStorage.getItem(SCRIPTURE_FONT_SCALE_STORAGE_KEY)).toBe(
      "1.6",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "デフォルト文字サイズを保存しました。",
    );
    expect(
      screen.getByRole("link", { name: "聖書検索へ戻る" }),
    ).toHaveAttribute("href", "/scripture");
  });

  it("falls back to 100% when the saved value is invalid", () => {
    window.localStorage.setItem(SCRIPTURE_FONT_SCALE_STORAGE_KEY, "9");
    render(<DefaultSettingsForm />);

    expect(
      screen.getByRole("combobox", {
        name: "聖書投影のデフォルト文字サイズ",
      }),
    ).toHaveValue("1");
  });
});
