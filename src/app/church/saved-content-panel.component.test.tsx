import "@testing-library/jest-dom/vitest";

import axe from "axe-core";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FolderSummary,
  ScriptureBookmarkView,
} from "@/domain/saved-content";
import { SavedContentPanel } from "./saved-content-panel";

const folderId = "00000000-0000-4000-8000-000000000101";
const secondFolderId = "00000000-0000-4000-8000-000000000102";
const createdFolderId = "00000000-0000-4000-8000-000000000103";
const bookmarkId = "00000000-0000-4000-8000-000000000201";
const secondBookmarkId = "00000000-0000-4000-8000-000000000202";
const search = {
  book: "GEN",
  chapter: 1,
  startVerse: 1,
  endVerse: 2,
  language: "both" as const,
};
const searchTitle = "創世記/Genesis 1:1-2";

function folder(id: string, name: string, position: number): FolderSummary {
  return { id, name, position, isPinned: false, lastUsedAt: null };
}

function statefulFetcher() {
  let folders = [
    folder(folderId, "主日礼拝", 0),
    folder(secondFolderId, "祈祷会", 1),
  ];
  let bookmarks: ScriptureBookmarkView[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), "https://levi.example");
    if (init?.method !== "POST") {
      const selectedId = url.searchParams.get("folderId");
      if (selectedId) {
        const selected = folders.find(({ id }) => id === selectedId)!;
        return Response.json({ folder: selected, bookmarks });
      }
      return Response.json({ folders, orderIds: folders.map(({ id }) => id) });
    }
    const command = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (command.action === "create-folder") {
      const created = folder(
        createdFolderId,
        String(command.name),
        folders.length,
      );
      folders = [created, ...folders];
      return Response.json({ folder: created });
    }
    if (command.action === "create-bookmark") {
      const bookmark = {
        id: bookmarks.length === 0 ? bookmarkId : secondBookmarkId,
        folderId: String(command.folderId),
        position: bookmarks.length,
        title: String(command.title),
        search,
      };
      bookmarks = [...bookmarks, bookmark];
      return Response.json({ bookmark });
    }
    if (command.action === "open-bookmark")
      return Response.json({
        bookmark: bookmarks.find(({ id }) => id === command.bookmarkId),
      });
    if (command.action === "reorder-bookmarks") {
      const ids = command.ids as string[];
      bookmarks = ids.map((id, position) => ({
        ...bookmarks.find((item) => item.id === id)!,
        position,
      }));
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });
  return fetcher;
}

function renderPanel(
  fetcher = statefulFetcher(),
  current: typeof search | null = search,
) {
  return {
    fetcher,
    ...render(
      <SavedContentPanel
        currentSearch={current}
        currentSearchTitle={searchTitle}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    ),
  };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="ginmaku-add-bookmark-slot"></div>';
});

describe("SavedContentPanel", () => {
  it("shows only the Ginmaku accordion content and separate folder actions", async () => {
    const { fetcher } = renderPanel();
    const user = userEvent.setup();

    const worship = await screen.findByRole("button", { name: "主日礼拝" });
    expect(worship).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByLabelText("フォルダー名")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "フォルダーを削除" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ブックマーク名")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /を上へ/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: "フォルダの一覧" }),
    ).toHaveAttribute("href", "/folders");
    expect(
      screen.getByRole("link", { name: "フォルダの一覧" }),
    ).not.toHaveAttribute("target");

    await user.click(worship);
    expect(worship).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "祈祷会" }));
    expect(worship).toHaveAttribute("aria-expanded", "false");

    const createToggle = screen.getByRole("button", {
      name: "新規フォルダ作成",
    });
    await user.click(createToggle);
    const dateInput = screen.getByLabelText("日付");
    expect(dateInput).toHaveAttribute("type", "date");
    await user.type(dateInput, "2026-08-23");
    await user.type(screen.getByLabelText("集会名"), "第二礼拝");
    await user.click(screen.getByRole("button", { name: "作成" }));
    expect(
      await screen.findByRole("button", { name: "2026-08-23 第二礼拝" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      JSON.parse(
        String(
          fetcher.mock.calls.find(([, init]) =>
            String(init?.body).includes('"action":"create-folder"'),
          )?.[1]?.body,
        ),
      ),
    ).toMatchObject({ name: "2026-08-23 第二礼拝" });
  });

  it("adds the current search with Ginmaku's automatic title and reopens it", async () => {
    const onOpen = vi.fn().mockResolvedValue(undefined);
    const fetcher = statefulFetcher();
    const { container } = render(
      <SavedContentPanel
        currentSearch={search}
        currentSearchTitle={searchTitle}
        fetcher={fetcher}
        onOpen={onOpen}
      />,
    );
    const user = userEvent.setup();
    const favorite = await screen.findByRole("button", {
      name: "お気に入りに追加",
    });
    await user.click(favorite);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      JSON.parse(
        String(
          fetcher.mock.calls.find(([, init]) =>
            String(init?.body).includes('"action":"create-bookmark"'),
          )?.[1]?.body,
        ),
      ),
    ).toMatchObject({ folderId, title: searchTitle, ...search });

    const bookmark = await screen.findByRole("link", { name: searchTitle });
    expect(bookmark).toHaveAttribute("target", "projector");
    await user.click(bookmark);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(search));
    expect(
      await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      }),
    ).toMatchObject({ violations: [] });
  });

  it("reorders favorites by drag and by Alt plus arrow keys", async () => {
    const { container } = renderPanel();
    const user = userEvent.setup();
    const favorite = await screen.findByRole("button", {
      name: "お気に入りに追加",
    });
    await user.click(favorite);
    await user.click(favorite);

    const transferData = new Map<string, string>();
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: (format: string) => transferData.get(format) ?? "",
      setData: (format: string, value: string) =>
        transferData.set(format, value),
    } as unknown as DataTransfer;
    const first = container.querySelector<HTMLElement>(
      `[data-bookmark-id="${bookmarkId}"]`,
    )!;
    const second = container.querySelector<HTMLElement>(
      `[data-bookmark-id="${secondBookmarkId}"]`,
    )!;
    fireEvent.dragStart(second, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    const list = await screen.findByRole("list", { name: "保存した聖書箇所" });
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")[0]).toHaveAttribute(
        "data-bookmark-id",
        secondBookmarkId,
      ),
    );
    fireEvent.keyDown(within(list).getAllByRole("listitem")[1]!, {
      altKey: true,
      key: "ArrowUp",
    });
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")[0]).toHaveAttribute(
        "data-bookmark-id",
        bookmarkId,
      ),
    );
  });

  it("recovers the open folder when drag persistence fails", async () => {
    const backend = statefulFetcher();
    let rejectReorder = false;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (
        rejectReorder &&
        init?.method === "POST" &&
        String(init.body).includes('"action":"reorder-bookmarks"')
      )
        return Response.json(
          { error: { code: "SAVED_CONTENT_CONFLICT" } },
          { status: 409 },
        );
      return backend(input, init);
    });
    const { container } = renderPanel(fetcher);
    const user = userEvent.setup();
    const favorite = await screen.findByRole("button", {
      name: "お気に入りに追加",
    });
    await user.click(favorite);
    await user.click(favorite);
    rejectReorder = true;

    const rows = container.querySelectorAll<HTMLElement>("[data-bookmark-id]");
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      getData: () => secondBookmarkId,
      setData: vi.fn(),
    } as unknown as DataTransfer;
    fireEvent.dragStart(rows[1]!, { dataTransfer });
    fireEvent.dragOver(rows[0]!, { dataTransfer });
    fireEvent.drop(rows[0]!, { dataTransfer });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "保存内容を更新できませんでした。",
    );
  });

  it("keeps the empty sidebar concise, disables favorites, and focuses failures", async () => {
    const emptyFetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ folders: [], orderIds: [] }));
    const { unmount } = renderPanel(emptyFetcher, null);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "フォルダーとお気に入り" }),
      ).toHaveAttribute("aria-busy", "false"),
    );
    expect(screen.queryByText("フォルダーはまだありません。")).toBeNull();
    expect(
      screen.getByRole("button", { name: "お気に入りに追加" }),
    ).toBeDisabled();
    unmount();

    renderPanel(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      null,
    );
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
