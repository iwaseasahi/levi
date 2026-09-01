import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SlideSearchResult, SlideSummary } from "@/domain/slides/search";
import { SlideList } from "./slide-list";

const summary = (index: number): SlideSummary => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  title: `Synthetic ${index}`,
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
    const { unmount } = render(<SlideList fetcher={fetcher} />);
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
    expect(
      screen.queryByRole("button", { name: "一覧を更新" }),
    ).not.toBeInTheDocument();
    unmount();
    render(<SlideList fetcher={fetcher} />);
    expect(await screen.findByRole("alert")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "再試行" }));
    const link = await screen.findByRole("link", {
      name: "Synthetic 1",
    });
    expect(link).toHaveAttribute("href", `/slides/${summary(1).id}`);
    expect(link).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByRole("button", { name: "前の20件" }),
    ).not.toBeInTheDocument();
  });
  it("holds cursors for Back and disables page boundaries", async () => {
    const first: SlideSearchResult = {
      slides: Array.from({ length: 20 }, (_, i) => summary(i)),
      nextCursor: "cursor-1",
    };
    const pages: SlideSearchResult[] = [
      first,
      { slides: [summary(21)], nextCursor: null },
      first,
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
    expect(fetcher.mock.calls.at(-1)![0]).toBe("/api/church/slides?mode=all");
  });
  it("adds a row to the selected folder and reports mutation failures", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ slides: [summary(1)], nextCursor: null }),
      )
      .mockResolvedValueOnce(
        Response.json({ bookmark: { slideId: summary(1).id } }),
      )
      .mockResolvedValueOnce(
        Response.json({ slides: [summary(2)], nextCursor: null }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const saved = vi.fn();
    const user = userEvent.setup();
    const first = render(
      <SlideList
        fetcher={fetcher}
        selectedFolderId="00000000-0000-4000-8000-000000000100"
        onFavoriteSaved={saved}
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: "お気に入りに追加" }),
    );
    expect(fetcher.mock.calls[1]).toEqual([
      "/api/saved-content",
      expect.objectContaining({
        body: expect.stringContaining(`\"slideId\":\"${summary(1).id}\"`),
        method: "POST",
      }),
    ]);
    expect(saved).toHaveBeenCalledOnce();
    first.unmount();
    render(
      <SlideList
        fetcher={fetcher}
        selectedFolderId="00000000-0000-4000-8000-000000000100"
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: "お気に入りに追加" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "お気に入りに追加できませんでした",
    );
  });
  it("keeps a remounted list independent of an old read and renders titles as text", async () => {
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
    const old = render(<SlideList fetcher={fetcher} />);
    old.unmount();
    const { container } = render(<SlideList fetcher={fetcher} />);
    expect(await screen.findByRole("link", { name: title })).toBeVisible();
    expect(container.querySelector("script")).toBeNull();
    await act(async () =>
      resolve(Response.json({ slides: [summary(99)], nextCursor: null })),
    );
    expect(screen.queryByRole("link", { name: "Synthetic 99" })).toBeNull();
    expect(screen.getByRole("link", { name: title })).toBeVisible();
  });
});
