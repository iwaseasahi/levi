import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlideEditor } from "./slide-editor";
import { SlideDocument } from "./slide-document";

const { push, replace, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));
const initial = {
  id: "00000000-0000-4000-8000-000000000384",
  title: "Synthetic title",
  body: "First\n\n\n\nSecond",
  revision: 2,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};

describe("slide editor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockClear();
    replace.mockClear();
  });
  it("does not show input guidance below the text fields", () => {
    render(<SlideEditor fetcher={vi.fn<typeof fetch>()} />);
    const title = screen.getByLabelText("タイトル（必須）");
    const body = screen.getByLabelText("本文（必須）");
    expect(title).not.toHaveAccessibleDescription();
    expect(body).not.toHaveAccessibleDescription();
    expect(
      screen.queryByText(
        /1〜200文字|1〜100,000文字|1行|HTMLは文字として表示します。/,
      ),
    ).toBeNull();
  });
  it("previews the complete body without a valid title, writing or opening an audience", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const open = vi.spyOn(window, "open");
    const user = userEvent.setup();
    render(<SlideEditor fetcher={fetcher} />);
    const textarea = screen.getByLabelText("本文（必須）");
    fireEvent.change(textarea, {
      target: { value: "<script>synthetic</script>\n\n\n\nSecond" },
    });
    await user.click(screen.getByRole("button", { name: "保存前プレビュー" }));
    expect(
      screen
        .getByRole("region", { name: "本文プレビュー" })
        .querySelector("pre")?.textContent,
    ).toBe("<script>synthetic</script>\n\n\n\nSecond");
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("button", { name: "前のページ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "次のページ" })).toBeNull();
    expect(screen.queryByLabelText("ページを選択")).toBeNull();
    fireEvent.change(textarea, { target: { value: "Changed" } });
    expect(screen.getByText(/本文を変更しました/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "保存前プレビュー" }));
    expect(
      screen
        .getByRole("region", { name: "本文プレビュー" })
        .querySelector("pre")?.textContent,
    ).toBe("Changed");
    fireEvent.change(textarea, { target: { value: " \n\t" } });
    await user.click(screen.getByRole("button", { name: "保存前プレビュー" }));
    expect(screen.queryByRole("region", { name: "本文プレビュー" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("keeps native arrows and composition in the editor and validates before writing", async () => {
    const fetcher = vi.fn<typeof fetch>();
    render(<SlideEditor fetcher={fetcher} />);
    const textarea = screen.getByLabelText("本文（必須）");
    for (const key of ["ArrowUp", "ArrowDown"]) {
      expect(fireEvent.keyDown(textarea, { key, isComposing: true })).toBe(
        true,
      );
      expect(fireEvent.keyDown(textarea, { key })).toBe(true);
    }
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("alert")).toHaveTextContent("タイトルは1〜200文字");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("normalizes create input and disables duplicate saves while pending", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const user = userEvent.setup();
    render(<SlideEditor fetcher={fetcher} />);
    fireEvent.change(screen.getByLabelText("タイトル（必須）"), {
      target: { value: "  Synthetic  " },
    });
    fireEvent.change(screen.getByLabelText("本文（必須）"), {
      target: { value: "First\r\nSecond" },
    });
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByLabelText("本文（必須）")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "処理中…" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toEqual({
      title: "Synthetic",
      body: "First\nSecond",
    });
    expect(screen.queryByLabelText(/著者/)).not.toBeInTheDocument();
    resolve(Response.json({ slide: initial }, { status: 201 }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/slides/${initial.id}`),
    );
    expect(screen.getByRole("button", { name: "処理中…" })).toBeDisabled();
  });
  it("does not redirect after a pending mutation's editor unmounts", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(
      <SlideEditor initial={initial} fetcher={fetcher} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    unmount();
    resolve(Response.json({ slide: initial }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });
  it.each([409, 500, 401, 404])(
    "retains edits and focuses failure for status %s",
    async (status) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json({ error: { code: "FAILED" } }, { status }),
      );
      render(<SlideEditor initial={initial} fetcher={fetcher} />);
      fireEvent.change(screen.getByLabelText("本文（必須）"), {
        target: { value: "Unsaved edit" },
      });
      await userEvent.click(screen.getByRole("button", { name: "保存" }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveFocus();
      expect(screen.getByLabelText("本文（必須）")).toHaveValue("Unsaved edit");
      expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
      expect(fetcher.mock.calls[0]![1]?.method).toBe("PUT");
      expect(
        JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).expectedRevision,
      ).toBe(2);
      if (status === 409)
        expect(alert).toHaveTextContent("別の編集が保存されています");
      expect(push).not.toHaveBeenCalled();
    },
  );
  it("names the saved title in confirmation, restores focus on cancel, retains failed deletion and handles 204", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const user = userEvent.setup();
    render(<SlideEditor initial={initial} fetcher={fetcher} />);
    const button = screen.getByRole("button", { name: "スライドを削除" });
    await user.click(button);
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(initial.title),
    );
    expect(button).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "別の編集が保存されています",
    );
    expect(replace).not.toHaveBeenCalled();
    await user.click(button);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/slides"));
    expect(fetcher.mock.calls[1]![1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ expectedRevision: 2 }),
    });
  });
  it("shows loading, focuses read denial and retries without caching", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ slide: initial }));
    render(<SlideDocument id={initial.id} fetcher={fetcher} />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(await screen.findByRole("alert")).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(
      await screen.findByRole("heading", { name: initial.title }),
    ).toBeVisible();
    expect(fetcher).toHaveBeenLastCalledWith(
      `/api/church/slides/${initial.id}`,
      { cache: "no-store" },
    );
  });
  it("ignores a late Strict Mode load after the current editor was changed", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(Response.json({ slide: initial }));
    render(
      <StrictMode>
        <SlideDocument id={initial.id} editing fetcher={fetcher} />
      </StrictMode>,
    );
    const body = await screen.findByLabelText("本文（必須）");
    fireEvent.change(body, { target: { value: "Keep this draft" } });
    resolve(Response.json({ slide: { ...initial, body: "Stale" } }));
    await waitFor(() => expect(body).toHaveValue("Keep this draft"));
  });
});
