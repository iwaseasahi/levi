import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScriptureBookmarkView } from "@/domain/saved-content";
import { FolderEditPanel } from "./folder-edit-panel";

const { replaceRoute } = vi.hoisted(() => ({ replaceRoute: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceRoute }),
}));

const folderId = "00000000-0000-4000-8000-000000000101";
const bookmarkId = "00000000-0000-4000-8000-000000000201";
const secondBookmarkId = "00000000-0000-4000-8000-000000000202";
const search = {
  book: "GEN",
  chapter: 1,
  startVerse: 1,
  endVerse: 1,
  language: "both" as const,
};

function managementFetcher() {
  let folder = {
    id: folderId,
    name: "2026-08-23 第二礼拝",
    isPinned: true,
    position: 0,
    lastUsedAt: null,
  };
  let bookmarks: ScriptureBookmarkView[] = [
    {
      id: bookmarkId,
      folderId,
      position: 0,
      title: "創世記/Genesis 1:1",
      search,
    },
    {
      id: secondBookmarkId,
      folderId,
      position: 1,
      title: "創世記/Genesis 1:2",
      search: { ...search, startVerse: 2, endVerse: 2 },
    },
  ];
  return vi.fn<typeof fetch>(async (input, init) => {
    if (init?.method !== "POST") return Response.json({ folder, bookmarks });
    const command = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (command.action === "update-folder") {
      folder = {
        ...folder,
        name: String(command.name),
        isPinned: Boolean(command.isPinned),
      };
      return Response.json({ folder });
    }
    if (command.action === "delete-bookmark") {
      bookmarks = bookmarks.filter(({ id }) => id !== command.bookmarkId);
      return Response.json({ ok: true });
    }
    if (command.action === "reorder-bookmarks") {
      bookmarks = (command.ids as string[]).map((id, position) => ({
        ...bookmarks.find((bookmark) => bookmark.id === id)!,
        position,
      }));
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });
}

describe("folder management", () => {
  it("shows loading and focuses a recoverable load failure", async () => {
    let resolveLoad!: (response: Response) => void;
    const pendingLoad = new Promise<Response>((resolve) => {
      resolveLoad = resolve;
    });
    const { unmount } = render(
      <FolderEditPanel
        folderId={folderId}
        fetcher={vi.fn<typeof fetch>(() => pendingLoad)}
      />,
    );
    expect(screen.getByLabelText("読み込み中")).toBeVisible();
    resolveLoad(new Response(null, { status: 500 }));
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("保存内容を更新できませんでした。");
    unmount();
  });

  it("keeps folder and bookmark mutations on the separate editing surface", async () => {
    const fetcher = managementFetcher();
    render(<FolderEditPanel folderId={folderId} fetcher={fetcher} />);
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", {
        name: "フォルダーを編集",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "フォルダー設定" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "フォルダーの削除" }),
    ).not.toBeInTheDocument();
    const name = await screen.findByLabelText("フォルダー名");
    expect(
      screen.queryByLabelText(/^よく使うフォルダーに固定/),
    ).not.toBeInTheDocument();
    await user.clear(name);
    await user.type(name, "2026-08-30 第一礼拝");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/saved-content",
        expect.objectContaining({
          body: expect.stringContaining('"isPinned":true'),
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "フォルダーを更新しました。",
    );
    expect(
      screen.queryByRole("link", { name: "編集" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "削除" })).toHaveLength(2);

    const rows =
      document.querySelectorAll<HTMLTableRowElement>("[data-bookmark-id]");
    const transfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: () => secondBookmarkId,
      setData: vi.fn(),
    } as unknown as DataTransfer;
    fireEvent.dragStart(rows[1]!, { dataTransfer: transfer });
    fireEvent.dragOver(rows[0]!, { dataTransfer: transfer });
    fireEvent.drop(rows[0]!, { dataTransfer: transfer });
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/saved-content",
        expect.objectContaining({
          body: expect.stringContaining(
            `"ids":["${secondBookmarkId}","${bookmarkId}"]`,
          ),
        }),
      ),
    );

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(screen.getAllByRole("button", { name: "削除" })[0]!);
    await waitFor(() =>
      expect(document.querySelectorAll("[data-bookmark-id]")).toHaveLength(1),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "お気に入りを削除しました。",
    );

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "フォルダーを削除" }));
    await waitFor(() => expect(replaceRoute).toHaveBeenCalledWith("/folders"));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/saved-content",
      expect.objectContaining({
        body: expect.stringContaining('"action":"delete-folder"'),
      }),
    );
  });
});
