import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderListPanel } from "./folder-list-panel";

const pinnedFolderId = "00000000-0000-4000-8000-000000000101";
const recentFolderId = "00000000-0000-4000-8000-000000000102";

describe("FolderListPanel", () => {
  it("lists folders and links to their editors in the current tab", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        folders: [
          {
            id: pinnedFolderId,
            name: "主日礼拝",
            isPinned: true,
            position: 0,
            lastUsedAt: null,
          },
          {
            id: recentFolderId,
            name: "祈祷会",
            isPinned: false,
            position: 1,
            lastUsedAt: "2026-08-23T00:00:00.000Z",
          },
        ],
      }),
    );

    render(<FolderListPanel fetcher={fetcher} />);

    expect(
      await screen.findByRole("heading", { name: "フォルダの一覧" }),
    ).toBeVisible();
    expect(screen.getByText("固定")).toBeVisible();
    expect(screen.getByText("最近使用したフォルダー")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "主日礼拝を編集" }),
    ).toHaveAttribute("href", `/folders/${pinnedFolderId}/edit`);
    expect(
      screen.getByRole("link", { name: "主日礼拝を編集" }),
    ).not.toHaveAttribute("target");
    expect(
      screen.getByRole("link", { name: "御言葉の検索へ" }),
    ).toHaveAttribute("href", "/scripture");
  });

  it("shows an empty state when no folder exists", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ folders: [] }),
    );

    render(<FolderListPanel fetcher={fetcher} />);

    expect(await screen.findByText("フォルダーはまだありません")).toBeVisible();
  });

  it("keeps the initial fetcher across rerenders and retries", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ folders: [] }));
    const replacementFetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ folders: [] }),
    );
    const user = userEvent.setup();

    const { rerender } = render(<FolderListPanel fetcher={fetcher} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "フォルダーを読み込めませんでした。",
    );
    rerender(<FolderListPanel fetcher={replacementFetcher} />);
    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByText("フォルダーはまだありません")).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(replacementFetcher).not.toHaveBeenCalled();
  });
});
