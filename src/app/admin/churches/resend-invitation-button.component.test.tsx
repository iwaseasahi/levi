import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChurchUserList } from "./church-user-list";
import type { ResendInvitationState } from "@/application/admin/resend-church-user-invitation-controller";

const member = {
  id: "pending",
  email: "pending@example.invalid",
  name: "招待利用者",
  status: "PENDING" as const,
};
const props = {
  churchId: "church",
  churchName: "試験教会",
  users: [
    member,
    { ...member, id: "active", name: "有効利用者", status: "ACTIVE" as const },
  ],
  deleteAction: vi.fn(),
};

describe("resend invitation", () => {
  it("offers resend only for pending users in an active church", () => {
    const { rerender } = render(
      <ChurchUserList {...props} resendAction={vi.fn()} />,
    );
    expect(
      screen.getAllByRole("button", { name: /招待メールを再送/ }),
    ).toHaveLength(1);
    rerender(
      <ChurchUserList
        {...props}
        canResendInvitation={false}
        resendAction={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /招待メールを再送/ }),
    ).not.toBeInTheDocument();
  });
  it("submits scoped IDs by keyboard, disables duplicate submits and announces success", async () => {
    let resolve!: (state: ResendInvitationState) => void;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise<ResendInvitationState>((done) => {
          resolve = done;
        }),
    );
    const user = userEvent.setup();
    render(<ChurchUserList {...props} resendAction={action} />);
    const button = screen.getByRole("button", {
      name: /招待利用者.*招待メールを再送/,
    });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("送信中…");
    expect(Object.fromEntries(action.mock.calls[0]![1] as FormData)).toEqual({
      churchId: "church",
      userId: "pending",
    });
    await act(async () =>
      resolve({ status: "success", message: "招待メールを再送しました。" }),
    );
    expect(button).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "招待メールを再送しました。",
    );
  });
  it("announces failure and allows retry on the same row", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "error",
      message: "再送できませんでした。",
    });
    const user = userEvent.setup();
    render(<ChurchUserList {...props} resendAction={action} />);
    const button = screen.getByRole("button", { name: /招待メールを再送/ });
    await user.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "再送できませんでした。",
    );
    expect(button).toBeEnabled();
    await user.click(button);
    expect(action).toHaveBeenCalledTimes(2);
  });
});
