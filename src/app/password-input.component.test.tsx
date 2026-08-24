import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("disables the visibility control with its containing fieldset", () => {
    render(
      <fieldset disabled>
        <PasswordInput id="password" label="パスワード" name="password" />
      </fieldset>,
    );

    expect(
      screen.getByRole("button", { name: "パスワードを表示" }),
    ).toBeDisabled();
  });
});
