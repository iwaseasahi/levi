import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InviteChurchUserForm } from "./invite-church-user-form";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("利用者名"), "追加利用者");
  await user.type(
    screen.getByLabelText("ログイン用メールアドレス"),
    "additional@example.invalid",
  );
}

describe("InviteChurchUserForm", () => {
  it("submits the target church without making it editable", async () => {
    const action = vi.fn().mockResolvedValue({
      email: "additional@example.invalid",
      message: "教会利用者へ招待メールを送信しました。",
      status: "success",
    });
    render(
      <InviteChurchUserForm
        action={action}
        churchId="00000000-0000-4000-8000-000000000357"
        churchName="第一教会"
      />,
    );
    const user = userEvent.setup();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "利用者を招待" }));

    expect(action).toHaveBeenCalledOnce();
    const submitted = action.mock.calls[0]?.[1] as FormData;
    expect(submitted.get("churchId")).toBe(
      "00000000-0000-4000-8000-000000000357",
    );
    expect(screen.queryByLabelText("教会ID")).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "第一教会 / additional@example.invalid",
    );
    expect(screen.getByText(/3日間有効/)).toBeVisible();
  });

  it("focuses validation feedback and associates field errors", async () => {
    const action = vi.fn().mockResolvedValue({
      fieldErrors: { email: ["有効なメールアドレスを入力してください。"] },
      message: "入力内容を確認してください。",
      status: "validation-error",
    });
    render(
      <InviteChurchUserForm
        action={action}
        churchId="00000000-0000-4000-8000-000000000357"
        churchName="第一教会"
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("利用者名"), "追加利用者");
    await user.type(
      screen.getByLabelText("ログイン用メールアドレス"),
      "invalid@example.invalid",
    );
    await user.click(screen.getByRole("button", { name: "利用者を招待" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText("ログイン用メールアドレス")).toHaveAttribute(
      "aria-describedby",
      "invited-account-email-errors",
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(
      <InviteChurchUserForm
        action={vi.fn().mockResolvedValue({ status: "idle" })}
        churchId="00000000-0000-4000-8000-000000000357"
        churchName="第一教会"
      />,
    );

    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });
});
