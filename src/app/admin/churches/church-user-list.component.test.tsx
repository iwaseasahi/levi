import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DeleteChurchUserState } from "@/application/admin/delete-church-user-controller";
import { ChurchUserList } from "./church-user-list";

const member = {
  id: "member",
  email: "member@example.test",
  name: "利用者A",
  status: "ACTIVE" as const,
};
const props = { churchId: "church", churchName: "試験教会", users: [member] };

beforeAll(() => {
  // jsdom lacks native dialog methods; browser modal/focus behavior is covered by E2E.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("ChurchUserList deletion", () => {
  it.each([
    ["ACTIVE", "有効"],
    ["PENDING", "招待中"],
  ] as const)(
    "places the compact delete button beside %s status",
    (status, label) => {
      render(
        <ChurchUserList
          {...props}
          users={[{ ...member, status }]}
          deleteAction={vi.fn()}
        />,
      );
      const button = screen.getByRole("button", { name: /利用者A.*を削除/ });
      expect(button).toHaveTextContent(/^削除$/);
      expect(button).toHaveClass(
        "admin-church-action-control",
        "admin-delete-button",
      );
      expect(screen.getByText(label).nextElementSibling).toBe(button);
      expect(button.closest("dd")).toHaveClass("admin-church-user-actions");
    },
  );

  it("requires matching confirmation, submits scoped IDs, and announces success", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "success",
      message: "利用者を削除しました。",
    });
    const user = userEvent.setup();
    const { container } = render(
      <ChurchUserList {...props} deleteAction={action} />,
    );
    await user.click(screen.getByRole("button", { name: /利用者A.*を削除/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "教会、共有フォルダー、お気に入り、他の利用者は残ります。",
    );
    const submit = screen.getByRole("button", { name: "利用者を完全に削除" });
    expect(submit).toBeDisabled();
    const confirmation = screen.getByLabelText(
      "確認のため利用者のメールアドレスを入力してください",
    );
    confirmation.focus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
    await user.tab();
    expect(confirmation).toHaveFocus();
    await user.type(
      screen.getByLabelText(
        "確認のため利用者のメールアドレスを入力してください",
      ),
      "MEMBER@example.test",
    );
    expect(submit).toBeEnabled();
    confirmation.focus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();
    await user.tab();
    expect(confirmation).toHaveFocus();
    expect(
      (
        await axe.run(container, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
    await user.click(submit);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "利用者を削除しました。",
    );
    const form = action.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(form)).toEqual({
      churchId: "church",
      userId: "member",
      confirmationEmail: "MEMBER@example.test",
    });
  });
  it("cancels without deleting and restores trigger focus", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(<ChurchUserList {...props} deleteAction={action} />);
    const trigger = screen.getByRole("button", { name: /利用者A.*を削除/ });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(trigger).toHaveFocus();
    expect(action).not.toHaveBeenCalled();
  });
  it("locks pending actions, then shows and focuses a recoverable error", async () => {
    let finish!: (state: DeleteChurchUserState) => void;
    const action = vi.fn(
      () =>
        new Promise<DeleteChurchUserState>((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<ChurchUserList {...props} deleteAction={action} />);
    await user.click(screen.getByRole("button", { name: /利用者A.*を削除/ }));
    await user.type(
      screen.getByLabelText(
        "確認のため利用者のメールアドレスを入力してください",
      ),
      member.email,
    );
    await user.click(
      screen.getByRole("button", { name: "利用者を完全に削除" }),
    );
    expect(screen.getByRole("button", { name: "削除中…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDisabled();
    const event = new Event("cancel", { cancelable: true });
    screen.getByRole("dialog").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await act(async () =>
      finish({ status: "error", message: "もう一度お試しください。" }),
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "利用者を完全に削除" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    await user.click(screen.getByRole("button", { name: /利用者A.*を削除/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
