import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("shows loading, empty/retry/recent/all/no-match and keeps query whitespace", async () => {
    const responses: Array<Response | (() => Promise<Response>)> = [
      Response.json({ slides: [], nextCursor: null }),
      new Response(null, { status: 500 }),
      Response.json({ slides: [summary(1)], nextCursor: null }),
      Response.json({ slides: [], nextCursor: null }),
    ];
    const fetcher = vi.fn<typeof fetch>(async () => {
      const item = responses.shift()!;
      return typeof item === "function" ? item() : item;
    });
    const user = userEvent.setup();
    render(<SlideList fetcher={fetcher} />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(await screen.findByText("スライドはまだありません。")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "すべて" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(
      await screen.findByRole("link", { name: "Synthetic 1" }),
    ).toHaveAttribute("href", `/slides/${summary(1).id}`);
    expect(screen.getByText("Author")).toBeVisible();
    fireEvent.change(screen.getByLabelText("本文を検索"), {
      target: { value: " A\r\nB " },
    });
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(
      await screen.findByText("一致するスライドはありません。"),
    ).toBeVisible();
    expect(fetcher.mock.calls.at(-1)![0]).toBe(
      "/api/church/slides?mode=all&q=+A%0AB+",
    );
  });
  it("holds previous cursors, resets on filters and disables boundaries", async () => {
    const pages: SlideSearchResult[] = [
      { slides: [summary(0)], nextCursor: null },
      {
        slides: Array.from({ length: 20 }, (_, index) => summary(index)),
        nextCursor: "cursor-1",
      },
      { slides: [summary(21)], nextCursor: null },
      {
        slides: Array.from({ length: 20 }, (_, index) => summary(index)),
        nextCursor: "cursor-1",
      },
      { slides: [], nextCursor: null },
    ];
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(pages.shift()),
    );
    const user = userEvent.setup();
    render(<SlideList fetcher={fetcher} />);
    await screen.findByText("1ページ目 · 1件");
    await user.click(screen.getByRole("button", { name: "すべて" }));
    await screen.findByText("1ページ目 · 20件");
    const previous = screen.getByRole("button", { name: "前の20件" });
    expect(previous).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "次の20件" }));
    expect(await screen.findByText("2ページ目 · 1件")).toBeVisible();
    expect(screen.getByRole("button", { name: "次の20件" })).toBeDisabled();
    await user.click(previous);
    expect(await screen.findByText("1ページ目 · 20件")).toBeVisible();
    expect(String(fetcher.mock.calls[2]![0])).toContain("cursor=cursor-1");
    await user.click(screen.getByRole("button", { name: "最近の更新" }));
    await screen.findByText("スライドはまだありません。");
    expect(screen.getByRole("button", { name: "前の20件" })).toBeDisabled();
  });
  it("rejects overlong input locally and ignores a stale response after a new filter", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(
        Response.json({ slides: [summary(2)], nextCursor: null }),
      );
    const user = userEvent.setup();
    render(<SlideList fetcher={fetcher} />);
    fireEvent.change(screen.getByLabelText("本文を検索"), {
      target: { value: "a".repeat(201) },
    });
    await user.click(screen.getByRole("button", { name: "検索" }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "すべて" }));
    expect(
      await screen.findByRole("link", { name: "Synthetic 2" }),
    ).toBeVisible();
    resolve(Response.json({ slides: [summary(99)], nextCursor: null }));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Synthetic 99" })).toBeNull(),
    );
  });
});
