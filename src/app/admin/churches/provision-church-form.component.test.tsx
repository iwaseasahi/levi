import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProvisionChurchFormState } from "@/application/admin/provision-church-controller";
import { ProvisionChurchForm } from "./provision-church-form";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("教会名"), "テスト教会");
  await user.type(screen.getByLabelText("利用者名"), "教会利用者");
  await user.type(
    screen.getByLabelText("ログイン用メールアドレス"),
    "church@example.invalid",
  );
}

describe("ProvisionChurchForm", () => {
  it("is keyboard accessible and has no detectable accessibility violations", async () => {
    const { container } = render(
      <ProvisionChurchForm
        action={vi.fn().mockResolvedValue({ status: "idle" })}
      />,
    );
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByLabelText("教会名")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("利用者名")).toHaveFocus();

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("disables the complete form and announces loading", async () => {
    let completeAction: ((state: ProvisionChurchFormState) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<ProvisionChurchFormState>((resolve) => {
          completeAction = resolve;
        }),
    );
    render(<ProvisionChurchForm action={action} />);
    const user = userEvent.setup();
    await fillValidForm(user);

    await user.click(
      screen.getByRole("button", {
        name: "教会と初期アカウントを作成",
      }),
    );

    expect(screen.getByRole("button", { name: "作成中…" })).toBeDisabled();
    expect(
      screen.getByText("教会とアカウントを安全に作成しています。"),
    ).toBeInTheDocument();

    completeAction?.({
      churchName: "テスト教会",
      email: "church@example.invalid",
      message: "教会利用者へ招待メールを送信しました。",
      status: "success",
    });
    await screen.findByText("教会利用者へ招待メールを送信しました。");
  });

  it("focuses validation feedback and associates the field error", async () => {
    const action = vi.fn().mockResolvedValue({
      fieldErrors: { churchName: ["教会名を入力してください。"] },
      message: "入力内容を確認してください。",
      status: "validation-error",
    });
    render(<ProvisionChurchForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("教会名"), " ");
    await user.type(screen.getByLabelText("利用者名"), "教会利用者");
    await user.type(
      screen.getByLabelText("ログイン用メールアドレス"),
      "church@example.invalid",
    );

    await user.click(
      screen.getByRole("button", {
        name: "教会と初期アカウントを作成",
      }),
    );

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText("教会名")).toHaveAttribute(
      "aria-describedby",
      "church-name-errors",
    );
    expect(screen.getByText("教会名を入力してください。")).toBeVisible();
  });

  it("shows the invitation destination and 72-hour validity", async () => {
    const action = vi.fn().mockResolvedValue({
      churchName: "テスト教会",
      email: "church@example.invalid",
      message: "教会利用者へ招待メールを送信しました。",
      status: "success",
    });
    render(<ProvisionChurchForm action={action} />);
    const user = userEvent.setup();
    await fillValidForm(user);

    await user.click(
      screen.getByRole("button", {
        name: "教会と初期アカウントを作成",
      }),
    );

    expect(screen.getByText("メール招待")).toBeVisible();
    expect(
      screen.getByText("メール内のパスワード設定リンクは3日間有効です。"),
    ).toBeVisible();
  });
});
