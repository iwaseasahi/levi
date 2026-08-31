import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SlideSearchResult, SlideSummary } from "@/domain/slides/search";
import { SlideList } from "./slide-list";

const summary = (index: number): SlideSummary => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  title: `Synthetic ${index}`,
  author: index % 2 ? "Author" : null,
  revision: 1,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
});
describe("SlideList", () => {
  it("lists all slides without mode/search controls, and supports empty/error/retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ slides: [], nextCursor: null }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ slides: [summary(1)], nextCursor: null }),
      );
    const user = userEvent.setup();
    render(<SlideList fetcher={fetcher} />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(await screen.findByText("スライドはまだありません。")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "最近の更新" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "すべて" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("本文を検索")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "次の20件" }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls[0]).toEqual([
      "/api/church/slides?mode=all",
      { cache: "no-store" },
    ]);
    await user.click(screen.getByRole("button", { name: "一覧を更新" }));
    expect(await screen.findByRole("alert")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    const link = await screen.findByRole("link", {
      name: "Synthetic 1",
    });
    expect(link).toHaveAttribute("href", `/slides/${summary(1).id}`);
    expect(link).toHaveAccessibleDescription("著者：Author");
    expect(
      screen.queryByRole("button", { name: "前の20件" }),
    ).not.toBeInTheDocument();
  });
  it("holds cursors for Back, disables boundaries and refreshes from the first page", async () => {
    const first: SlideSearchResult = {
      slides: Array.from({ length: 20 }, (_, i) => summary(i)),
      nextCursor: "cursor-1",
    };
    const pages: SlideSearchResult[] = [
      first,
      { slides: [summary(21)], nextCursor: null },
      first,
      { slides: [], nextCursor: null },
    ];
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(pages.shift()),
    );
    const user = userEvent.setup();
    render(<SlideList fetcher={fetcher} />);
    await screen.findByText(/1ページ目 · 20件/);
    const previous = screen.getByRole("button", { name: "前の20件" });
    expect(previous).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "次の20件" }));
    await screen.findByText(/2ページ目 · 1件/);
    expect(screen.getByRole("button", { name: "次の20件" })).toBeDisabled();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("21");
    expect(fetcher.mock.calls[1]![0]).toBe(
      "/api/church/slides?mode=all&cursor=cursor-1",
    );
    await user.click(previous);
    await screen.findByText(/1ページ目 · 20件/);
    expect(previous).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "一覧を更新" }));
    await screen.findByText("スライドはまだありません。");
    expect(
      screen.queryByRole("button", { name: "次の20件" }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.at(-1)![0]).toBe("/api/church/slides?mode=all");
  });
  it("ignores a stale response after refreshing and renders titles as text", async () => {
    let resolve!: (response: Response) => void;
    const title = "<script>synthetic</script>";
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(
        Response.json({ slides: [{ ...summary(2), title }], nextCursor: null }),
      );
    const user = userEvent.setup();
    const { container } = render(<SlideList fetcher={fetcher} />);
    await user.click(screen.getByRole("button", { name: "一覧を更新" }));
    expect(await screen.findByRole("link", { name: title })).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
    await act(async () =>
      resolve(Response.json({ slides: [summary(99)], nextCursor: null })),
    );
    expect(screen.queryByRole("link", { name: "Synthetic 99" })).toBeNull();
    expect(screen.getByRole("link", { name: title })).toBeVisible();
  });
});
