import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteChurchButton } from "./delete-church-button";

describe("DeleteChurchButton", () => {
  it("requires the exact church name before submitting the irreversible deletion", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({
      message: "教会を削除しました。",
      status: "success",
    });
    const { container } = render(
      <DeleteChurchButton
        action={action}
        churchId="church-1"
        churchName="第一教会"
      />,
    );

    await user.click(screen.getByRole("button", { name: "第一教会を削除" }));

    expect(screen.getByRole("dialog", { name: "教会を削除" })).toBeVisible();
    expect(
      screen.getByText(/所属利用者、ログイン情報、セッション/),
    ).toBeVisible();
    const submit = screen.getByRole("button", { name: "教会を完全に削除" });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByLabelText("確認のため「第一教会」と入力してください"),
      "第一教会",
    );
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("churchId")).toBe("church-1");
    expect(formData.get("confirmationName")).toBe("第一教会");
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it("closes without deleting when cancellation is requested", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <DeleteChurchButton
        action={action}
        churchId="church-1"
        churchName="第一教会"
      />,
    );

    await user.click(screen.getByRole("button", { name: "第一教会を削除" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
