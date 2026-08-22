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
import { describe, expect, it, vi } from "vitest";
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
      folders = [...folders, created];
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
    if (command.action === "update-folder") {
      folders = folders.map((item) =>
        item.id === command.folderId
          ? {
              ...item,
              name: String(command.name ?? item.name),
              isPinned:
                command.isPinned === undefined
                  ? item.isPinned
                  : Boolean(command.isPinned),
            }
          : item,
      );
      return Response.json({
        folder: folders.find(({ id }) => id === command.folderId),
      });
    }
    if (command.action === "reorder-folders") {
      const ids = command.ids as string[];
      folders = ids.map((id, position) => ({
        ...folders.find((item) => item.id === id)!,
        position,
      }));
      return Response.json({ ok: true });
    }
    if (command.action === "reorder-bookmarks") {
      const ids = command.ids as string[];
      bookmarks = ids.map((id, position) => ({
        ...bookmarks.find((item) => item.id === id)!,
        position,
      }));
      return Response.json({ ok: true });
    }
    if (command.action === "delete-bookmark") {
      bookmarks = bookmarks.filter(({ id }) => id !== command.bookmarkId);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  });
  return fetcher;
}

describe("SavedContentPanel", () => {
  it("toggles folder creation and opens or closes one accordion folder", async () => {
    const fetcher = statefulFetcher();
    render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    const createToggle = await screen.findByRole("button", {
      name: "新規フォルダ作成",
    });
    expect(createToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByLabelText("新しいフォルダー名"),
    ).not.toBeInTheDocument();

    await user.click(createToggle);
    expect(createToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("新しいフォルダー名")).toHaveFocus();
    await user.click(createToggle);
    expect(
      screen.queryByLabelText("新しいフォルダー名"),
    ).not.toBeInTheDocument();

    const worship = screen.getByRole("button", { name: "主日礼拝" });
    expect(worship).toHaveAttribute("aria-expanded", "false");
    await user.click(worship);
    expect(worship).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("フォルダー名")).toBeVisible();
    await user.click(worship);
    expect(worship).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("フォルダー名")).not.toBeInTheDocument();

    await user.click(createToggle);
    await user.type(screen.getByLabelText("新しいフォルダー名"), "青年会");
    await user.click(screen.getByRole("button", { name: "作成" }));
    expect(
      await screen.findByRole("button", { name: "青年会" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.queryByLabelText("新しいフォルダー名"),
    ).not.toBeInTheDocument();
  });

  it("saves and reopens a scripture bookmark accessibly", async () => {
    const fetcher = statefulFetcher();
    const onOpen = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={onOpen}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    await user.type(screen.getByLabelText("ブックマーク名"), "創世記 1:1–2");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );

    const bookmark = await screen.findByRole("button", {
      name: "創世記 1:1–2",
    });
    await user.click(bookmark);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(search));
    expect(
      await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      }),
    ).toMatchObject({ violations: [] });
  });

  it("reorders scripture bookmarks by drag and retains keyboard controls", async () => {
    const fetcher = statefulFetcher();
    const { container } = render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    await user.type(screen.getByLabelText("ブックマーク名"), "創世記 1:1");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );
    await user.type(screen.getByLabelText("ブックマーク名"), "創世記 1:2");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );

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
    fireEvent.dragEnter(first, { dataTransfer });
    expect(first).toHaveClass("bookmark-drop-target");
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });

    const bookmarkList = await screen.findByRole("list", {
      name: "保存した聖書箇所",
    });
    await waitFor(() =>
      expect(
        within(bookmarkList).getAllByRole("listitem")[0],
      ).toHaveTextContent("創世記 1:2"),
    );
    expect(
      JSON.parse(
        String(
          fetcher.mock.calls.find(([, init]) =>
            String(init?.body).includes('"action":"reorder-bookmarks"'),
          )?.[1]?.body,
        ),
      ),
    ).toMatchObject({ ids: [secondBookmarkId, bookmarkId] });

    await user.click(screen.getByRole("button", { name: "創世記 1:1を上へ" }));
    await waitFor(() =>
      expect(
        within(bookmarkList).getAllByRole("listitem")[0],
      ).toHaveTextContent("創世記 1:1"),
    );
  });

  it("reloads the open folder when drag persistence fails", async () => {
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
          {
            status: 409,
          },
        );
      return backend(input, init);
    });
    const { container } = render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    for (const title of ["創世記 1:1", "創世記 1:2"]) {
      await user.type(screen.getByLabelText("ブックマーク名"), title);
      await user.click(
        screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
      );
    }
    rejectReorder = true;
    const folderLoadsBefore = fetcher.mock.calls.filter(
      ([input, init]) =>
        init?.method !== "POST" &&
        String(input).includes(`folderId=${folderId}`),
    ).length;
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "保存内容を更新できませんでした。",
    );
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(
          ([input, init]) =>
            init?.method !== "POST" &&
            String(input).includes(`folderId=${folderId}`),
        ).length,
      ).toBeGreaterThan(folderLoadsBefore),
    );
    expect(
      within(
        screen.getByRole("list", { name: "保存した聖書箇所" }),
      ).getAllByRole("listitem")[0],
    ).toHaveTextContent("創世記 1:1");
  });

  it("renames, pins, reorders, and physically deletes with confirmation", async () => {
    const fetcher = statefulFetcher();
    render(
      <SavedContentPanel
        currentSearch={search}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "主日礼拝" }));
    await user.clear(screen.getByLabelText("フォルダー名"));
    await user.type(screen.getByLabelText("フォルダー名"), "礼拝用");
    await user.click(screen.getByRole("button", { name: "名前を変更" }));
    expect(await screen.findByRole("button", { name: "礼拝用" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "よく使うフォルダーに固定" }),
    );
    expect(
      await screen.findByRole("button", { name: "固定：礼拝用" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "礼拝用を下へ" }));
    const list = screen.getByRole("list", { name: "フォルダー" });
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent(
      "礼拝用",
    );

    await user.type(screen.getByLabelText("ブックマーク名"), "削除対象");
    await user.click(
      screen.getByRole("button", { name: "現在の聖書箇所を保存" }),
    );
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(
      await screen.findByRole("button", { name: "削除対象を削除" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "削除対象" })).toBeNull(),
    );
  });

  it("shows an empty state and focuses failures", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ folders: [], orderIds: [] }));
    const { unmount } = render(
      <SavedContentPanel
        currentSearch={null}
        fetcher={fetcher}
        onOpen={vi.fn()}
      />,
    );
    expect(
      await screen.findByText("フォルダーはまだありません。"),
    ).toBeVisible();
    unmount();

    render(
      <SavedContentPanel
        currentSearch={null}
        fetcher={vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))}
        onOpen={vi.fn()}
      />,
    );
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });
});
